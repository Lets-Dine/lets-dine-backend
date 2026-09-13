import { Injectable } from "@nestjs/common";
import { PaginatedResponse } from "../../../../common/interfaces";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import { DishReviewRepository } from "../../domain/repositories/dish-review.repository";
import { FetchDishReviewsQuery } from "../../interfaces/http/validations/fetch-dish-reviews.validation";

/** §8 — the reviews under a dish, public and always purchase-verified. */
@Injectable()
export class FetchDishReviewsUsecase {
  constructor(private readonly dishReviewRepository: DishReviewRepository) {}

  async execute(dishId: string, query: FetchDishReviewsQuery): Promise<PaginatedResponse<IDishReview>> {
    const { minRating, maxRating, onlyWithComment, ...pagination } = query;

    return this.dishReviewRepository.fetchAll({ dishId, minRating, maxRating, onlyWithComment }, pagination);
  }
}
