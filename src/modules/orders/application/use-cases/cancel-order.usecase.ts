import { Injectable } from "@nestjs/common";
import { AuditAction, OrderStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { CancelOrderInput } from "../../interfaces/http/validations/cancel-order.validation";

@Injectable()
export class CancelOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: CancelOrderInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const existing = await this.orderRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }

    if (existing.status === OrderStatus.CANCELLED) {
      throw new ConflictException(ORDER_ERROR_MESSAGES.ALREADY_CANCELLED);
    }
    if (!new Order(existing).isCancellable()) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.NOT_CANCELLABLE,
        detail: { status: existing.status },
      });
    }

    const cancelled = await this.orderRepository.update(
      id,
      { status: OrderStatus.CANCELLED, cancelReason: dto.reason },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record(
      { action: AuditAction.order_cancelled, subject: `Order ${existing.reference}`, detail: dto.reason },
      authEntity
    );

    return cancelled;
  }
}
