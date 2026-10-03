import { Injectable } from "@nestjs/common";
import { ForbiddenException } from "../../../../common/exceptions";
import { AuthEntity, canAccessBranch, PaginatedResponse } from "../../../../common/interfaces";
import { DISH_REVIEW_ERROR_MESSAGES } from "../../domain/constants";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import { DishReviewRepository } from "../../domain/repositories/dish-review.repository";
import { FetchRestaurantReviewsQuery } from "../../interfaces/http/validations/fetch-restaurant-reviews.validation";

/** §30 — the dashboard's review feed, filterable but never editable by staff. */
@Injectable()
export class FetchRestaurantReviewsUsecase {
  constructor(private readonly dishReviewRepository: DishReviewRepository) {}

  async execute(query: FetchRestaurantReviewsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IDishReview>> {
    const { branchId, dishId, minRating, maxRating, onlyWithComment, ...pagination } = query;

    if (branchId && !canAccessBranch(authEntity, branchId)) throw new ForbiddenException(DISH_REVIEW_ERROR_MESSAGES.BRANCH_FORBIDDEN);
    // An owner sees every branch's reviews unless they narrow; anyone else only their assigned branches.
    const branchIds = branchId ? [branchId] : authEntity.branchIds === "all" ? undefined : authEntity.branchIds;

    return this.dishReviewRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, branchIds, dishId, minRating, maxRating, onlyWithComment },
      pagination
    );
  }
}
