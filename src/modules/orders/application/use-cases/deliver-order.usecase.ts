import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus, OrderType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

/**
 * Hand-over: the courier has delivered. The ticket moves to `SETTLE` — handed over, the money not yet
 * settled with the courier. Settling (`SettleDeliveryOrderUsecase`, in the delivery module) is what
 * takes the payment and completes the order, so a delivery never counts as a sale before the money is in.
 */
@Injectable()
export class DeliverOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const existing = await this.orderRepository.findById(id);
    if (!existing || !isInActiveBranch(authEntity, existing)) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }
    if (existing.orderType !== OrderType.DELIVERY) {
      throw new BadRequestException(ORDER_ERROR_MESSAGES.NOT_DELIVERY_ORDER);
    }
    // Sequential on purpose — same rule `UpdateOrderStatusUsecase` enforces: a delivery order can
    // only be delivered once it's actually out for delivery, never straight from READY.
    if (existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.INVALID_TRANSITION,
        detail: { from: existing.status, to: OrderStatus.SETTLE },
      });
    }

    const updated = await this.orderRepository.$transaction(async tx => {
      // The driver hands over every plated line at once — no item goes SERVED on
      // its own for a delivery order (see `OrderItemEntity`), so this is the one
      // moment they all catch up together.
      await this.orderRepository.markReadyItemsServed(id, { tx });
      return this.orderRepository.update(id, { status: OrderStatus.SETTLE }, { tx, actorId: authEntity.sub });
    });

    await this.auditLogService.record(
      {
        action: AuditAction.order_status_changed,
        subject: `Order ${existing.reference}`,
        detail: `${existing.status} → ${updated.status} — delivered, ${updated.total} ${updated.currency} to settle`,
      },
      authEntity
    );

    this.eventEmitter.emit("order.updated", updated);

    return updated;
  }
}
