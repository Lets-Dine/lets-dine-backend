import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchRestaurantReviewsDto } from "../../application/dto/fetch-restaurant-reviews.dto";
import { FetchRestaurantReviewsUsecase } from "../../application/use-cases/fetch-restaurant-reviews.usecase";
import { DISH_REVIEW_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";

@Controller("restaurant/reviews")
export class RestaurantReviewController {
  constructor(private readonly fetchRestaurantReviewsUsecase: FetchRestaurantReviewsUsecase) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["reviews:view"]]))
  async fetchAll(
    @Query() query: FetchRestaurantReviewsDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IDishReview>>> {
    const reviews = await this.fetchRestaurantReviewsUsecase.execute(query, authEntity);
    return buildHttpResponse(reviews, DISH_REVIEW_SUCCESS_MESSAGES.DISH_REVIEWS_FETCHED);
  }
}
