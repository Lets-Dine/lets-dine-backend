import { Injectable } from "@nestjs/common";
import { OrderItemStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { type IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { OrderItemEntity } from "../../domain/entity/order-item.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";
import { deriveOrderStatus } from "../../domain/utils/order-status.util";

/**
 * §20/§27 — the diner's own cancel, one line at a time, and only before the
 * kitchen has touched it. Ownership is checked the same way
 * `FetchSessionOrderUsecase` does — a `NotFoundException` on mismatch, so a
 * prober can't tell another table's order id even exists.
 *
 * Not audit-logged: `audit_logs.actor_id` is a foreign key to `users`
 * (`actor_role` a `StaffRole`) — an anonymous dining session has neither, so
 * this stays outside §51's staff/management trail rather than faking an actor.
 */
@Injectable()
export class CancelOrderItemUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(orderId: string, itemId: string, session: IDiningSession): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const order = await this.orderRepository.findById(orderId, { tx });
      if (!order || !new Order(order).belongsToSession(session.id)) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
      }

      const item = order.items.find(candidate => candidate.id === itemId);
      if (!item) throw new NotFoundException(ORDER_ERROR_MESSAGES.ITEM_NOT_FOUND);

      if (!new OrderItemEntity(item).isCancellable()) {
        throw new BadRequestException({ ...ORDER_ERROR_MESSAGES.ITEM_NOT_CANCELLABLE, detail: { status: item.status } });
      }

      const restaurant = await this.restaurantRepository.findById(order.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const afterItemUpdate = await this.orderRepository.updateItemStatus(itemId, OrderItemStatus.CANCELLED, { tx });

      const billableLines = afterItemUpdate.items
        .filter(line => line.status !== OrderItemStatus.CANCELLED)
        .map(line => ({ unitPrice: line.unitPrice, quantity: line.quantity }));
      const totals = calculateOrderTotals(billableLines, restaurant, order.discount);
      const status = deriveOrderStatus(afterItemUpdate.items, order.acceptedAt, order.cancelledAt);

      const updated = await this.orderRepository.update(orderId, { status, ...totals }, { tx });

      this.eventEmitter.emit("order.updated", updated);

      return updated;
    });
  }
}
