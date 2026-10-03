import { Injectable } from "@nestjs/common";
import { OrderItemStatus, OrderStatus } from "@prisma/client";
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

      const restaurant = await this.restaurantRepository.findByIdForBranch(order.restaurantId, order.branchId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const afterItemUpdate = await this.orderRepository.updateItemStatus(itemId, OrderItemStatus.CANCELLED, { tx });

      const billableLines = afterItemUpdate.items
        .filter(line => line.status !== OrderItemStatus.CANCELLED)
        .map(line => ({ unitPrice: line.unitPrice, quantity: line.quantity }));
      const totals = calculateOrderTotals(billableLines, restaurant, order.discount, order.deliveryFee ?? 0);
      const status = deriveOrderStatus(afterItemUpdate.items, order.cancelledAt, order.orderType, {
        isFloorOrder: Boolean(order.floorId),
        paidAt: order.paidAt,
      });
      const orderNewStatus = status ?? order.status;
      const updated = await this.orderRepository.update(
        orderId,
        { status: orderNewStatus, completedAt: orderNewStatus === OrderStatus.COMPLETED ? new Date() : order.completedAt, ...totals },
        { tx }
      );

      this.eventEmitter.emit("order.updated", updated);

      return updated;
    });
  }
}
