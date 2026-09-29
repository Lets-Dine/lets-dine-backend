import { Injectable } from "@nestjs/common";
import { AuditAction, OrderItemStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { IDishVariant } from "../../../dish-variants/domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../../dish-variants/domain/repositories/dish-variant.repository";
import { DiningSessionRepository } from "../../../dining-sessions/domain/repositories/dining-session.repository";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderItemAddOn, IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";
import { isOrderOpen } from "../../domain/utils/order-status.util";
import { AddOrderItemInput } from "../../interfaces/http/validations/add-order-item.validation";

/** Two lines of the same dish are only the same line while their add-on selections match too. */
function sameAddOnSet(existing: IOrderItemAddOn[], requestedIds: string[]): boolean {
  const existingIds = existing.map(addOn => addOn.addOnId).sort();
  const sortedRequested = [...requestedIds].sort();
  return existingIds.length === sortedRequested.length && existingIds.every((id, index) => id === sortedRequested[index]);
}

/**
 * Staff can still adjust a live tab — a guest asked for one more plate — right
 * from the payment sheet. It lands on the table's most recent order *of its
 * currently open visit*, but only while that order is still open itself
 * (§20 below covers per-item detail). Once that order has been settled or
 * cancelled, a new plate is a new round of service, not a correction to a
 * closed-out ticket — so it starts a fresh order instead of reopening the
 * old one, the same way starting completely fresh (see the final paragraph)
 * already does.
 *
 * A table's `tableId` outlives any one visit — a completed order from a visit
 * that ended sessions ago is still "this table's latest order" by timestamp
 * alone, so the lookup is scoped to the open session, never just the table.
 * Otherwise a table seated fresh after sitting empty could silently reopen a
 * stranger's old, already-settled ticket instead of starting a new one.
 *
 * §20 — merging into an existing line only makes sense while the kitchen
 * hasn't touched it yet: bumping the quantity on a line that's already
 * PREPARING/READY/SERVED would silently mark the new unit as already cooked.
 * So a repeat of a dish only merges into a still-PENDING line for it; once
 * that line has started, a second helping gets its own fresh PENDING line —
 * the same way a real kitchen treats a re-order as a new ticket.
 *
 * A table staff just seated (see `StartTableSessionUsecase`) has an open visit
 * but nobody has ordered yet — there is no order to land on, so the first dish
 * starts one instead, the same way a diner's own first checkout would.
 */
@Injectable()
export class AddOrderItemUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly dishRepository: DishRepository,
    private readonly addOnRepository: AddOnRepository,
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(tableId: string, dto: AddOrderItemInput, authEntity: AuthEntity): Promise<IOrderWithItems> {
    return this.orderRepository.$transaction(async tx => {
      const table = await this.diningTableRepository.findById(tableId, { tx });
      if (!table || table.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND);
      }

      const dish = await this.dishRepository.findById(dto.dishId, { tx });
      if (!dish || dish.restaurantId !== authEntity.restaurantId) {
        throw new NotFoundException({ ...ORDER_ERROR_MESSAGES.DISH_NOT_FOUND, detail: { dishId: dto.dishId } });
      }

      // §36 — never trust a client-sent price/name for the variant either; it's re-resolved
      // against this dish's own non-archived variants, same rule as dishes and add-ons.
      const dishVariants = await this.dishVariantRepository.findByDishId(dish.id, { isArchived: false, tx });
      let variant: IDishVariant | undefined;
      if (dto.variantId) {
        variant = dishVariants.find(candidate => candidate.id === dto.variantId && candidate.isAvailable);
        if (!variant) {
          throw new BadRequestException({
            ...ORDER_ERROR_MESSAGES.VARIANT_UNAVAILABLE,
            detail: { variantId: dto.variantId, dishId: dish.id },
          });
        }
      } else if (dishVariants.length > 0) {
        throw new BadRequestException({ ...ORDER_ERROR_MESSAGES.VARIANT_REQUIRED, detail: { dishId: dish.id } });
      }

      // §36 — every add-on is re-resolved against this dish's own linked add-ons, never
      // trusted from the client; restaurant scoping is inherited transitively through the
      // dish-add-on link.
      const linkedAddOns = dto.addOnIds.length ? await this.addOnRepository.findLinkedToDish(dish.id, { tx }) : [];
      const selectedAddOns = dto.addOnIds.map(id => {
        const addOn = linkedAddOns.find(candidate => candidate.id === id);
        if (!addOn || addOn.isArchived || !addOn.isAvailable) {
          throw new BadRequestException({ ...ORDER_ERROR_MESSAGES.ADD_ON_UNAVAILABLE, detail: { addOnId: id, dishId: dish.id } });
        }
        return addOn;
      });
      const unitPrice = (variant ? variant.price : dish.price) + selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
      const addOnSnapshots: IOrderItemAddOn[] = selectedAddOns.map(addOn => ({
        addOnId: addOn.id,
        nameSnapshot: addOn.name,
        priceSnapshot: addOn.price,
      }));
      const variantId = variant?.id ?? null;
      const variantNameSnapshot = variant?.name ?? null;
      const variantPriceSnapshot = variant?.price ?? null;

      const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
      if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const session = await this.diningSessionRepository.findOpenByTableId(tableId, { tx });
      const latest = await this.orderRepository.findLatestByTableId(tableId, authEntity.restaurantId, { tx });
      const order = latest && session && latest.sessionId === session.id && isOrderOpen(latest.status) ? latest : null;

      if (!order) {
        if (!session) throw new NotFoundException(ORDER_ERROR_MESSAGES.NO_OPEN_VISIT_FOR_TABLE);

        const totals = calculateOrderTotals([{ unitPrice, quantity: 1 }], restaurant);
        const created = await this.orderRepository.create(
          {
            restaurantId: authEntity.restaurantId,
            tableId,
            sessionId: session.id,
            currency: restaurant.currency,
            items: [
              {
                dishId: dish.id,
                dishNameSnapshot: dish.name,
                imageUrlSnapshot: dish.imageUrl,
                unitPrice,
                quantity: 1,
                notes: "",
                variantId,
                variantNameSnapshot,
                variantPriceSnapshot,
                addOns: addOnSnapshots,
              },
            ],
            ...totals,
          },
          { tx }
        );

        await this.auditLogService.record(
          { action: AuditAction.order_item_added, subject: `Order ${created.reference}`, detail: `+1 ${dish.name}` },
          authEntity,
          tx
        );

        return created;
      }

      // A repeat order only merges into an existing PENDING line for the *same* dish+variant
      // combination — otherwise a repeat order of "Small" could silently merge quantity into
      // an existing "Large" line.
      const mergeable = order.items.find(
        item =>
          item.dishId === dish.id &&
          item.variantId === variantId &&
          item.status === OrderItemStatus.PENDING &&
          sameAddOnSet(item.addOns, dto.addOnIds)
      );

      const resultingLines = mergeable
        ? order.items.map(item => (item.id === mergeable.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...order.items, { dishId: dish.id, unitPrice, quantity: 1 }];

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
                  unitPrice,
                  quantity: 1,
                  notes: "",
                  variantId,
                  variantNameSnapshot,
                  variantPriceSnapshot,
                  addOns: addOnSnapshots,
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
