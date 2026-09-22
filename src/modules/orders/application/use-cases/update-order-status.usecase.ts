import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { UpdateOrderStatusInput } from "../../interfaces/http/validations/update-order-status.validation";

/**
 * §20/§27 — with items now carrying their own kitchen status, this endpoint
 * is left with exactly one manual move: accepting a new ticket. Everything
 * past that (`PREPARING`/`READY`/`COMPLETED`) is read off the items via
 * `deriveOrderStatus`, not set directly here.
 */
@Injectable()
export class UpdateOrderStatusUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, dto: UpdateOrderStatusInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const existing = await this.orderRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }

    if (dto.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException(ORDER_ERROR_MESSAGES.STATUS_FOLLOWS_ITEMS);
    }

    if (!new Order(existing).canTransitionTo(dto.status)) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.INVALID_TRANSITION,
        detail: { from: existing.status, to: dto.status, allowed: new Order(existing).nextStatuses() },
      });
    }

    const updated = await this.orderRepository.update(id, { status: dto.status, acceptedAt: new Date() }, { actorId: authEntity.sub });

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
