import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
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

      const dishes = await this.dishRepository.findManyByIds(
        dto.lines.map(line => line.dishId),
        { tx }
      );

      const items = dto.lines.map(line => this.toOrderItem(line, dishes, restaurant.id));
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

  private toOrderItem(line: CreateOrderInput["lines"][number], dishes: IDish[], restaurantId: string): IOrderItemCreate {
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

    return {
      dishId: dish.id,
      dishNameSnapshot: dish.name,
      imageUrlSnapshot: dish.imageUrl,
      // §36 — the price comes from the dish row, never from the cart.
      unitPrice: dish.price,
      quantity: line.quantity,
      notes: line.note ?? "",
    };
  }
}
