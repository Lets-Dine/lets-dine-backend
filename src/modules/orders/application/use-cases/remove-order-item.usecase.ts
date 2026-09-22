import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";

/**
 * Drops a line entirely, or takes one off — whichever the quantity allows.
 * Works on any order, settled or not, so a mis-charge can still be corrected.
 * Targets the one row named by `itemId` directly rather than rebuilding the
 * order's whole item list — every other line (and its kitchen status) is
 * left untouched.
 */
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

      const resultingLines = order.items
        .filter(candidate => candidate.id !== itemId || candidate.quantity > 1)
        .map(candidate => ({
          unitPrice: candidate.unitPrice,
          quantity: candidate.id === itemId ? candidate.quantity - 1 : candidate.quantity,
        }));

      const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const totals = calculateOrderTotals(resultingLines, restaurant);
      const updated = await this.orderRepository.syncItems(
        order.id,
        {
          create: [],
          updateQuantity: item.quantity > 1 ? [{ id: item.id, quantity: item.quantity - 1 }] : [],
          deleteIds: item.quantity > 1 ? [] : [item.id],
        },
        totals,
        { tx }
      );

      await this.auditLogService.record(
        { action: AuditAction.order_item_removed, subject: `Order ${order.reference}`, detail: `-1 ${item.dishNameSnapshot}` },
        authEntity,
        tx
      );

      return updated;
    });
  }
}
