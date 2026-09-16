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

/** §20/§27 — one move forward at a time, and every move is on the record. */
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

    if (!new Order(existing).canTransitionTo(dto.status)) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.INVALID_TRANSITION,
        detail: { from: existing.status, to: dto.status, allowed: new Order(existing).nextStatuses() },
      });
    }

    const updated = await this.orderRepository.update(
      id,
      {
        status: dto.status,
        completedAt: dto.status === OrderStatus.COMPLETED ? new Date() : existing.completedAt,
      },
      { actorId: authEntity.sub }
    );

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
