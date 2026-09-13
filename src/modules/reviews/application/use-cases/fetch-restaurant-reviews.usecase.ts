import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import { DishReviewRepository } from "../../domain/repositories/dish-review.repository";
import { FetchRestaurantReviewsQuery } from "../../interfaces/http/validations/fetch-restaurant-reviews.validation";

/** §30 — the dashboard's review feed, filterable but never editable by staff. */
@Injectable()
export class FetchRestaurantReviewsUsecase {
  constructor(private readonly dishReviewRepository: DishReviewRepository) {}

  async execute(query: FetchRestaurantReviewsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IDishReview>> {
    const { dishId, minRating, maxRating, onlyWithComment, ...pagination } = query;

    return this.dishReviewRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, dishId, minRating, maxRating, onlyWithComment },
      pagination
    );
  }
}
