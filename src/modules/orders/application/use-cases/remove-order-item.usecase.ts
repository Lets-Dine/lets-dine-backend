import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { IOrderItemCreate, OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";

/** Drops a line entirely, or takes one off — whichever the quantity allows. Works on any order, settled or not, so a mis-charge can still be corrected. */
@Injectable()
export class RemoveOrderItemUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(orderId: string, itemId: string, authEntity: AuthEntity): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const order = await this.orderRepository.findById(orderId, { tx });
      if (!order || order.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
      }

      const item = order.items.find(candidate => candidate.id === itemId);
      if (!item) throw new NotFoundException(ORDER_ERROR_MESSAGES.ITEM_NOT_FOUND);

      const items: IOrderItemCreate[] = order.items
        .filter(candidate => candidate.id !== itemId || candidate.quantity > 1)
        .map(candidate => ({
          dishId: candidate.dishId,
          dishNameSnapshot: candidate.dishNameSnapshot,
          imageUrlSnapshot: candidate.imageUrlSnapshot,
          unitPrice: candidate.unitPrice,
          quantity: candidate.id === itemId ? candidate.quantity - 1 : candidate.quantity,
          notes: candidate.notes,
        }));

      const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const totals = calculateOrderTotals(items, restaurant);
      const updated = await this.orderRepository.replaceItems(order.id, items, totals, { tx });

      await this.auditLogService.record(
        { action: AuditAction.order_item_removed, subject: `Order ${order.reference}`, detail: `-1 ${item.dishNameSnapshot}` },
        authEntity,
        tx
      );

      return updated;
    });
  }
}
