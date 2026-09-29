import { Injectable } from "@nestjs/common";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";
import { CancelOrderInput } from "../../interfaces/http/validations/cancel-order.validation";

@Injectable()
export class CancelOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(id: string, dto: CancelOrderInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const existing = await this.orderRepository.findById(id, { tx });
      if (!existing || existing.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
      }

      if (existing.status === OrderStatus.CANCELLED) {
        throw new ConflictException(ORDER_ERROR_MESSAGES.ALREADY_CANCELLED);
      }
      if (!new Order(existing).isCancellable(existing.items)) {
        throw new BadRequestException({
          ...ORDER_ERROR_MESSAGES.NOT_CANCELLABLE,
          detail: { status: existing.status },
        });
      }

      const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      // §20/§27 — a whole-order cancel voids every line the kitchen hasn't already served; a
      // served dish is food already delivered and stays on the bill regardless of the ticket's fate.
      let items = existing.items;
      for (const item of items) {
        if (item.status === OrderItemStatus.SERVED || item.status === OrderItemStatus.CANCELLED) continue;
        items = (await this.orderRepository.updateItemStatus(item.id, OrderItemStatus.CANCELLED, { tx })).items;
      }

      const billable = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
      const totals = calculateOrderTotals(billable, restaurant, existing.discount);

      const cancelled = await this.orderRepository.update(
        id,
        { status: OrderStatus.CANCELLED, cancelReason: dto.reason, cancelledAt: new Date(), ...totals },
        { tx, actorId: authEntity.sub }
      );

      await this.auditLogService.record(
        { action: AuditAction.order_cancelled, subject: `Order ${existing.reference}`, detail: dto.reason },
        authEntity,
        tx
      );

      this.eventEmitter.emit("order.updated", cancelled);

      return cancelled;
    });
  }
}
