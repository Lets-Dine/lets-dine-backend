import { Injectable } from "@nestjs/common";
import { AuditAction, OrderItemStatus } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";
import { AddOrderItemInput } from "../../interfaces/http/validations/add-order-item.validation";

/**
 * Staff can still adjust a live tab — a guest asked for one more plate — right
 * from the payment sheet. It always lands on the table's most recent order,
 * whatever that order's status, so a correction after settling works the same
 * way as one mid-service.
 *
 * §20 — merging into an existing line only makes sense while the kitchen
 * hasn't touched it yet: bumping the quantity on a line that's already
 * PREPARING/READY/SERVED would silently mark the new unit as already cooked.
 * So a repeat of a dish only merges into a still-PENDING line for it; once
 * that line has started, a second helping gets its own fresh PENDING line —
 * the same way a real kitchen treats a re-order as a new ticket.
 */
@Injectable()
export class AddOrderItemUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly dishRepository: DishRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(tableId: string, dto: AddOrderItemInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const table = await this.diningTableRepository.findById(tableId, { tx });
      if (!table || table.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND);
      }

      const order = await this.orderRepository.findLatestByTableId(tableId, authEntity.restaurantId, { tx });
      if (!order) throw new NotFoundException(ORDER_ERROR_MESSAGES.NO_ORDER_FOR_TABLE);

      const dish = await this.dishRepository.findById(dto.dishId, { tx });
      if (!dish || dish.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException({ ...ORDER_ERROR_MESSAGES.DISH_NOT_FOUND, detail: { dishId: dto.dishId } });
      }

      const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const mergeable = order.items.find(item => item.dishId === dish.id && item.status === OrderItemStatus.PENDING);

      const resultingLines = mergeable
        ? order.items.map(item => (item.id === mergeable.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...order.items, { dishId: dish.id, unitPrice: dish.price, quantity: 1 }];

      const totals = calculateOrderTotals(resultingLines, restaurant);
      const updated = await this.orderRepository.syncItems(
        order.id,
        {
          create: mergeable
            ? []
            : [
                {
                  dishId: dish.id,
                  dishNameSnapshot: dish.name,
                  imageUrlSnapshot: dish.imageUrl,
                  unitPrice: dish.price,
                  quantity: 1,
                  notes: "",
                },
              ],
          updateQuantity: mergeable ? [{ id: mergeable.id, quantity: mergeable.quantity + 1 }] : [],
          deleteIds: [],
        },
        totals,
        { tx }
      );

      await this.auditLogService.record(
        { action: AuditAction.order_item_added, subject: `Order ${order.reference}`, detail: `+1 ${dish.name}` },
        authEntity,
        tx
      );

      return updated;
    });
  }
}
