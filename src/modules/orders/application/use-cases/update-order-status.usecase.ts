import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus, OrderType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { IOrderUpdate, OrderRepository } from "../../domain/repositories/order.repository";
import { UpdateOrderStatusInput } from "../../interfaces/http/validations/update-order-status.validation";

/**
 * §20/§27 — with items now carrying their own kitchen status, whole-order
 * status mostly moves by itself. Two manual moves still go through here,
 * both explicit (from, to) overrides rather than item-derived: accepting a
 * new dine-in ticket (`PENDING → ACCEPTED`), and — for a delivery order only
 * — the two steps `deriveOrderStatus` deliberately never reaches on its own
 * (`READY → OUT_FOR_DELIVERY → COMPLETED`), since dispatch/hand-over isn't
 * something any one item's status can tell you.
 */
const DELIVERY_MANUAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.READY]: OrderStatus.OUT_FOR_DELIVERY,
  [OrderStatus.OUT_FOR_DELIVERY]: OrderStatus.COMPLETED,
};

@Injectable()
export class UpdateOrderStatusUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, dto: UpdateOrderStatusInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const existing = await this.orderRepository.findById(id);
    if (!existing || !isInActiveBranch(authEntity, existing)) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }

    const isDeliveryAdvance = existing.orderType === OrderType.DELIVERY && DELIVERY_MANUAL_TRANSITIONS[existing.status] === dto.status;

    if (dto.status !== OrderStatus.ACCEPTED && !isDeliveryAdvance) {
      throw new BadRequestException(ORDER_ERROR_MESSAGES.STATUS_FOLLOWS_ITEMS);
    }

    if (!new Order(existing).canTransitionTo(dto.status)) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.INVALID_TRANSITION,
        detail: { from: existing.status, to: dto.status, allowed: new Order(existing).nextStatuses() },
      });
    }

    const patch: IOrderUpdate = { status: dto.status };
    if (dto.status === OrderStatus.ACCEPTED) patch.acceptedAt = new Date();
    if (dto.status === OrderStatus.COMPLETED) patch.completedAt = new Date();

    const updated = await this.orderRepository.update(id, patch, { actorId: authEntity.sub });

    await this.auditLogService.record(
      {
        action: AuditAction.order_status_changed,
        subject: `Order ${existing.reference}`,
        detail: `${existing.status} → ${updated.status}`,
      },
      authEntity
    );

    this.eventEmitter.emit("order.updated", updated);

    return updated;
  }
}
