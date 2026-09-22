import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { OrderItemEntity } from "../../domain/entity/order-item.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { deriveOrderStatus } from "../../domain/utils/order-status.util";
import { AdvanceOrderItemStatusInput } from "../../interfaces/http/validations/advance-order-item-status.validation";

/**
 * §20 — the kitchen fires and plates one line at a time. Each advance is
 * validated against that line's own state machine, then `Order.status` is
 * re-derived from the resulting set of items — it is never written directly.
 */
@Injectable()
export class AdvanceOrderItemStatusUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(orderId: string, itemId: string, dto: AdvanceOrderItemStatusInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const order = await this.orderRepository.findById(orderId, { tx });
      if (!order || order.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
      }

      const item = order.items.find(candidate => candidate.id === itemId);
      if (!item) throw new NotFoundException(ORDER_ERROR_MESSAGES.ITEM_NOT_FOUND);

      const entity = new OrderItemEntity(item);
      if (!entity.canTransitionTo(dto.status)) {
        throw new BadRequestException({
          ...ORDER_ERROR_MESSAGES.ITEM_INVALID_TRANSITION,
          detail: { from: item.status, to: dto.status, allowed: entity.nextStatuses() },
        });
      }

      const afterItemUpdate = await this.orderRepository.updateItemStatus(itemId, dto.status, { tx });
      const status = deriveOrderStatus(afterItemUpdate.items, order.acceptedAt, order.cancelledAt);
      const updated =
        status === afterItemUpdate.status
          ? afterItemUpdate
          : await this.orderRepository.update(orderId, { status }, { tx, actorId: authEntity.sub });

      await this.auditLogService.record(
        {
          action: AuditAction.order_status_changed,
          subject: `Order ${order.reference}`,
          detail: `${item.dishNameSnapshot} — ${item.status} → ${dto.status}`,
        },
        authEntity,
        tx
      );

      this.eventEmitter.emit("order.updated", updated);

      return updated;
    });
  }
}
