import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { PrismaTransaction } from "../../../../common/prisma";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { IDishVariant } from "../../../dish-variants/domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../../dish-variants/domain/repositories/dish-variant.repository";
import { IDish } from "../../../dishes/domain/interfaces/dish.interface";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { IOrderItemCreate, OrderRepository } from "../../domain/repositories/order.repository";
import { calculateOrderTotals } from "../../domain/utils/money.util";
import { CreateOrderInput } from "../../interfaces/http/validations/create-order.validation";

/**
 * §37 — the whole placement is one transaction: validate the session's
 * restaurant, re-read every dish and its price server-side, refuse anything
 * unavailable, compute the totals from the restaurant's own fee configuration,
 * then write the order and its lines together.
 *
 * §36 — a retry carrying the same idempotency key gets the first order back
 * rather than a second one.
 */
@Injectable()
export class CreateOrderUsecase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly dishRepository: DishRepository,
    private readonly addOnRepository: AddOnRepository,
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(dto: CreateOrderInput, session: IDiningSession, options?: { idempotencyKey?: string }): Promise<IOrderWithItems> {
    if (options?.idempotencyKey) {
      const alreadyPlaced = await this.orderRepository.findByIdempotencyKey(options.idempotencyKey);
      // A replayed retry, not a new ticket — the pass has already been told once.
      if (alreadyPlaced) return alreadyPlaced;
    }

    const order = await this.orderRepository.$transaction(async tx => {
      const restaurant = await this.restaurantRepository.findById(session.restaurantId, { tx });
      if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      const dishIds = dto.lines.map(line => line.dishId);
      const dishes = await this.dishRepository.findManyByIds(dishIds, { tx });
      const variantsByDish = await this.dishVariantRepository.findManyByDishIds(dishIds, { isArchived: false, tx });

      const items = await Promise.all(dto.lines.map(line => this.toOrderItem(line, dishes, variantsByDish, restaurant.id, tx)));
      const totals = calculateOrderTotals(items, restaurant);

      return this.orderRepository.create(
        {
          restaurantId: restaurant.id,
          tableId: session.tableId,
          sessionId: session.id,
          currency: restaurant.currency,
          idempotencyKey: options?.idempotencyKey ?? null,
          items,
          ...totals,
        },
        { tx }
      );
    });

    // Emitted after the transaction commits — the pass should never be told
    // about a ticket that a later step in the same transaction might still roll back.
    this.eventEmitter.emit("order.created", order);

    return order;
  }

  private async toOrderItem(
    line: CreateOrderInput["lines"][number],
    dishes: IDish[],
    variantsByDish: Record<string, IDishVariant[]>,
    restaurantId: string,
    tx: PrismaTransaction
  ): Promise<IOrderItemCreate> {
    const dish = dishes.find(candidate => candidate.id === line.dishId);

    if (!dish || dish.restaurantId !== restaurantId || dish.isArchived) {
      throw new NotFoundException({ ...ORDER_ERROR_MESSAGES.DISH_NOT_FOUND, detail: { dishId: line.dishId } });
    }
    if (!dish.isAvailable) {
      throw new BadRequestException({
        ...ORDER_ERROR_MESSAGES.DISH_UNAVAILABLE,
        detail: { dishId: dish.id, name: dish.name },
      });
    }

    // §36 — never trust a client-sent price/name for the variant either; it's re-resolved
    // against this dish's own non-archived variants, same rule as dishes and add-ons.
    const dishVariants = variantsByDish[dish.id] ?? [];
    let variant: IDishVariant | undefined;
    if (line.variantId) {
      variant = dishVariants.find(candidate => candidate.id === line.variantId && candidate.isAvailable);
      if (!variant) {
        throw new BadRequestException({
          ...ORDER_ERROR_MESSAGES.VARIANT_UNAVAILABLE,
          detail: { variantId: line.variantId, dishId: dish.id },
        });
      }
    } else if (dishVariants.length > 0) {
      throw new BadRequestException({ ...ORDER_ERROR_MESSAGES.VARIANT_REQUIRED, detail: { dishId: dish.id } });
    }

    // §36 — every add-on is re-resolved against this dish's own linked add-ons, never
    // trusted from the client; restaurant scoping is inherited transitively through the
    // dish-add-on link, so no separate restaurantId check is needed here.
    const linkedAddOns = line.addOnIds.length ? await this.addOnRepository.findLinkedToDish(dish.id, { tx }) : [];
    const selectedAddOns = line.addOnIds.map(id => {
      const addOn = linkedAddOns.find(candidate => candidate.id === id);
      if (!addOn || addOn.isArchived || !addOn.isAvailable) {
        throw new BadRequestException({ ...ORDER_ERROR_MESSAGES.ADD_ON_UNAVAILABLE, detail: { addOnId: id, dishId: dish.id } });
      }
      return addOn;
    });
    const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);

    return {
      dishId: dish.id,
      dishNameSnapshot: dish.name,
      imageUrlSnapshot: dish.imageUrl,
      // §36 — the price comes from the selected variant (or the dish row when it has none)
      // plus every selected add-on's own row, never from the cart.
      unitPrice: (variant ? variant.price : dish.price) + addOnsTotal,
      quantity: line.quantity,
      notes: line.note ?? "",
      variantId: variant?.id ?? null,
      variantNameSnapshot: variant?.name ?? null,
      variantPriceSnapshot: variant?.price ?? null,
      addOns: selectedAddOns.map(addOn => ({ addOnId: addOn.id, nameSnapshot: addOn.name, priceSnapshot: addOn.price })),
    };
  }
}
