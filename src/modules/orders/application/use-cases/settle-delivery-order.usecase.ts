import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus, OrderType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

/**
 * The delivery equivalent of `SettleTableUsecase` — there's no table to
 * batch by, so this settles exactly one order: staff confirm hand-over and
 * payment collected, and the ticket is fast-forwarded to COMPLETED, the same
 * "an order's status *is* its payment state" rule dine-in settling follows.
 */
@Injectable()
export class SettleDeliveryOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const existing = await this.orderRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }
    if (existing.orderType !== OrderType.DELIVERY) {
      throw new BadRequestException(ORDER_ERROR_MESSAGES.NOT_DELIVERY_ORDER);
    }
    // Sequential on purpose — same rule `UpdateOrderStatusUsecase` enforces: a delivery order can
    // only be settled once it's actually out for delivery, never straight from READY.
    if (existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.INVALID_TRANSITION,
        detail: { from: existing.status, to: OrderStatus.COMPLETED },
      });
    }

    const updated = await this.orderRepository.$transaction(async tx => {
      // The driver hands over every plated line at once — no item goes SERVED on
      // its own for a delivery order (see `OrderItemEntity`), so this is the one
      // moment they all catch up together.
      await this.orderRepository.markReadyItemsServed(id, { tx });
      return this.orderRepository.update(id, { status: OrderStatus.COMPLETED, completedAt: new Date() }, { tx, actorId: authEntity.sub });
    });

    await this.auditLogService.record(
      {
        action: AuditAction.order_status_changed,
        subject: `Order ${existing.reference}`,
        detail: `${existing.status} → ${updated.status} — settled ${updated.total} ${updated.currency}`,
      },
      authEntity
    );

    this.eventEmitter.emit("order.updated", updated);

    return updated;
  }
}
