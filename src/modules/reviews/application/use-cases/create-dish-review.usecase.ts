import { Injectable, Logger } from "@nestjs/common";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { LoyaltyService } from "../../../loyalty/application/loyalty.service";
import { Order } from "../../../orders/domain/entity/order.entity";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { DISH_REVIEW_ERROR_MESSAGES } from "../../domain/constants";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import { DishReviewRepository } from "../../domain/repositories/dish-review.repository";
import { DishTagRepository } from "../../domain/repositories/dish-tag.repository";
import { CreateDishReviewInput } from "../../interfaces/http/validations/create-dish-review.validation";

/**
 * §10/§11 — the only way a review exists. Four things have to hold: the order is
 * this session's, it actually contained the dish, that dish has been served
 * (no need to wait for the rest of the order), and it has not been rated on
 * that order before.
 */
@Injectable()
export class CreateDishReviewUsecase {
  constructor(
    private readonly dishReviewRepository: DishReviewRepository,
    private readonly dishTagRepository: DishTagRepository,
    private readonly orderRepository: OrderRepository,
    private readonly loyaltyService: LoyaltyService
  ) {}

  private readonly logger = new Logger(CreateDishReviewUsecase.name);

  async execute(dto: CreateDishReviewInput, session: IDiningSession): Promise<IDishReview> {
    const order = await this.orderRepository.findById(dto.orderId);
    if (!order || !new Order(order).belongsToSession(session.id)) {
      throw new NotFoundException(DISH_REVIEW_ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    if (!order.items.some(item => item.dishId === dto.dishId)) {
      throw new BadRequestException(DISH_REVIEW_ERROR_MESSAGES.DISH_NOT_IN_ORDER);
    }

    if (!new Order(order).isDishReviewable(order.items, dto.dishId)) {
      throw new BadRequestException({
        ...DISH_REVIEW_ERROR_MESSAGES.DISH_NOT_SERVED,
        detail: { status: order.status },
      });
    }

    const existing = await this.dishReviewRepository.findByOrderAndDish(dto.orderId, dto.dishId);
    if (existing) throw new ConflictException(DISH_REVIEW_ERROR_MESSAGES.ALREADY_REVIEWED);

    const tagIds = await this.resolveTagIds(dto.tags);

    const review = await this.dishReviewRepository.create({
      restaurantId: order.restaurantId,
      dishId: dto.dishId,
      orderId: order.id,
      sessionId: session.id,
      overall: dto.overall,
      taste: dto.taste,
      portion: dto.portion,
      value: dto.value,
      wouldOrderAgain: dto.wouldOrderAgain,
      comment: dto.comment,
      tagIds,
    });

    // A thank-you in points, once per order. The review is already saved and must never wait on, or fail
    // because of, the ledger: it is started here and its outcome only logged.
    void this.loyaltyService
      .grantReviewBonus({ id: order.id, restaurantId: order.restaurantId, customerId: order.customerId ?? session.customerId })
      .catch(error =>
        this.logger.warn(`Review bonus not granted for order ${order.id}: ${error instanceof Error ? error.message : error}`)
      );

    return review;
  }

  /** §9 — tags come from a fixed vocabulary; anything else is a typo or an attack. */
  private async resolveTagIds(labels?: string[]): Promise<string[]> {
    if (!labels?.length) return [];

    const tags = await this.dishTagRepository.findByLabels(labels);
    if (tags.length !== new Set(labels).size) {
      const known = tags.map(tag => tag.label);
      throw new BadRequestException({
        ...DISH_REVIEW_ERROR_MESSAGES.UNKNOWN_TAG,
        detail: { unknown: labels.filter(label => !known.includes(label)) },
      });
    }

    return tags.map(tag => tag.id);
  }
}
