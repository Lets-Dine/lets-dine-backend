import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderType } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { PrismaTransaction } from "../../../../common/prisma";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { isTakingOrders } from "../../../branches/domain/utils/branch-hours.util";
import { CustomerRepository } from "../../../customers/domain/repositories/customer.repository";
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
    private readonly customerRepository: CustomerRepository,
    private readonly branchRepository: BranchRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(dto: CreateOrderInput, session: IDiningSession, options?: { idempotencyKey?: string }): Promise<IOrderWithItems> {
    if (options?.idempotencyKey) {
      const alreadyPlaced = await this.orderRepository.findByIdempotencyKey(options.idempotencyKey);
      // A replayed retry, not a new ticket — the pass has already been told once.
      if (alreadyPlaced) return alreadyPlaced;
    }

    const order = await this.orderRepository.$transaction(async tx => {
      const restaurant = await this.restaurantRepository.findByIdForBranch(session.restaurantId, session.branchId, { tx });
      if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

      // Closed means closed for every diner at this branch — a QR scan can still seat someone, but nothing is cooked.
      const branch = await this.branchRepository.findById(session.branchId, { tx });
      if (!branch || !isTakingOrders(branch)) throw new BadRequestException(ORDER_ERROR_MESSAGES.BRANCH_CLOSED);

      const dishIds = dto.lines.map(line => line.dishId);
      const dishes = await this.dishRepository.findManyByIds(dishIds, { tx });
      const variantsByDish = await this.dishVariantRepository.findManyByDishIds(dishIds, { isArchived: false, tx });

      const items = await Promise.all(dto.lines.map(line => this.toOrderItem(line, dishes, variantsByDish, session.branchId, tx)));

      // §22 — `customerId` is the one field exclusive to a delivery session (a floor
      // session also has no `tableId`, so that alone can't be the delivery check).
      // `orderType` is what everything else (totals, transitions, staff filtering) branches on.
      const isDelivery = !!session.customerId;
      const deliveryFee = isDelivery ? (restaurant.deliveryFeeAmount ?? 0) : 0;
      const totals = calculateOrderTotals(items, restaurant, 0, deliveryFee);

      const delivery = isDelivery ? await this.resolveDeliveryDetails(dto, session, tx) : null;
      // A dine-in diner's identity (§16b, now also table — not floor-only) is given at order
      // time, not session start — upserted the same way a delivery customer is, by
      // `(restaurantId, phone)`. This is who the order is for, not where it goes — see
      // `floorVisitorName` below, which stays floor-only.
      const dineInCustomer = !isDelivery ? await this.resolveDineInCustomer(dto, session, restaurant.id, tx) : null;

      return this.orderRepository.create(
        {
          restaurantId: restaurant.id,
          branchId: session.branchId,
          tableId: session.tableId,
          sessionId: session.id,
          // §16b — set directly from the session rather than joined in later; the one thing
          // every floor-order check downstream (status derivation, single-order payment) should
          // key off instead of the display-only `floorVisitorName`/`floorName`.
          floorId: session.floorId,
          orderType: isDelivery ? OrderType.DELIVERY : OrderType.DINE_IN,
          customerId: isDelivery ? (session.customerId ?? null) : (dineInCustomer?.id ?? null),
          // §16b — which cabin/room/spot on the floor to bring this order to,
          // typed in at checkout and snapshotted here (never the session's,
          // since editing the session later must not rewrite a placed order).
          // Falls back to the session's own legacy, session-start-collected
          // name for a session that still carries one.
          floorVisitorName: session.floorId ? dto.floorVisitorName?.trim() || session.floorVisitorName : null,
          currency: restaurant.currency,
          idempotencyKey: options?.idempotencyKey ?? null,
          items,
          ...totals,
          ...(delivery ?? {}),
        },
        { tx }
      );
    });

    // Emitted after the transaction commits — the pass should never be told
    // about a ticket that a later step in the same transaction might still roll back.
    this.eventEmitter.emit("order.created", order);

    return order;
  }

  /**
   * §36 — the diner's phone/name always come from the `Customer` row tied to
   * their session, never the client; only the address/note can be overridden
   * per order (e.g. deliver to the office instead of home this time).
   */
  private async resolveDeliveryDetails(dto: CreateOrderInput, session: IDiningSession, tx: PrismaTransaction) {
    const customer = session.customerId ? await this.customerRepository.findById(session.customerId, session.restaurantId, { tx }) : null;
    if (!customer) throw new NotFoundException(ORDER_ERROR_MESSAGES.CUSTOMER_NOT_FOUND);

    return {
      deliveryPhone: customer.phone,
      deliveryCustomerName: customer.name,
      deliveryAddress: dto.deliveryAddress ?? customer.defaultAddress,
      deliveryNote: dto.deliveryNote ?? customer.defaultNote,
    };
  }

  /**
   * §16b — unlike delivery, a dine-in diner's (table or floor) phone/name come straight from
   * the client on this one request, not a session already tied to a `Customer`; trusting them
   * here is fine because nothing priced or restaurant-scoped turns on it. A no-op whenever the
   * client doesn't send one — a dine-in order has always been placeable without it.
   *
   * A table session is one party's visit, so whoever the first order was placed for owns
   * the rest of it: later orders reuse that customer and any `customer` sent is ignored.
   * (A floor session is many unrelated diners at once, so it identifies per order.)
   */
  private async resolveDineInCustomer(dto: CreateOrderInput, session: IDiningSession, restaurantId: string, tx: PrismaTransaction) {
    if (session.tableId && !session.floorId) {
      const earlier = await this.orderRepository.findBySessionId(session.id, restaurantId, session.branchId);
      const customerId = earlier.find(order => order.customerId)?.customerId;
      if (customerId) return this.customerRepository.findById(customerId, restaurantId, { tx });
    }
    if (!dto.customer) return null;
    return this.customerRepository.upsert(
      {
        restaurantId,
        phone: dto.customer.phone.trim(),
        name: dto.customer.name.trim(),
      },
      { tx }
    );
  }

  private async toOrderItem(
    line: CreateOrderInput["lines"][number],
    dishes: IDish[],
    variantsByDish: Record<string, IDishVariant[]>,
    branchId: string,
    tx: PrismaTransaction
  ): Promise<IOrderItemCreate> {
    const dish = dishes.find(candidate => candidate.id === line.dishId);

    // A dish is on one branch's menu; a session can only order from its own branch's.
    if (!dish || dish.branchId !== branchId || dish.isArchived) {
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
