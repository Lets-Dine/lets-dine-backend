import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { type IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { DinerSession } from "../../../dining-sessions/interfaces/http/decorators/diner-session.decorator";
import { DinerSessionGuard } from "../../../dining-sessions/interfaces/http/guards/diner-session.guard";
import { CreateDishReviewDto } from "../../application/dto/create-dish-review.dto";
import { FetchDishReviewsDto } from "../../application/dto/fetch-dish-reviews.dto";
import { CreateDishReviewUsecase } from "../../application/use-cases/create-dish-review.usecase";
import { FetchDishReviewsUsecase } from "../../application/use-cases/fetch-dish-reviews.usecase";
import { FetchDishTagsUsecase } from "../../application/use-cases/fetch-dish-tags.usecase";
import { DISH_REVIEW_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDishReview } from "../../domain/interfaces/dish-review.interface";
import { IDishTag } from "../../domain/interfaces/dish-tag.interface";

@Controller()
export class PublicReviewController {
  constructor(
    private readonly createDishReviewUsecase: CreateDishReviewUsecase,
    private readonly fetchDishReviewsUsecase: FetchDishReviewsUsecase,
    private readonly fetchDishTagsUsecase: FetchDishTagsUsecase
  ) {}

  @Get("public/dishes/:dishId/reviews")
  async fetchForDish(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @Query() query: FetchDishReviewsDto
  ): Promise<IHttpResponse<PaginatedResponse<IDishReview>>> {
    const reviews = await this.fetchDishReviewsUsecase.execute(dishId, query);
    return buildHttpResponse(reviews, DISH_REVIEW_SUCCESS_MESSAGES.DISH_REVIEWS_FETCHED);
  }

  @Get("public/review-tags")
  async fetchTags(): Promise<IHttpResponse<IDishTag[]>> {
    const tags = await this.fetchDishTagsUsecase.execute();
    return buildHttpResponse(tags, DISH_REVIEW_SUCCESS_MESSAGES.DISH_TAGS_FETCHED);
  }

  @Post("reviews")
  @UseGuards(DinerSessionGuard)
  async create(@Body() dto: CreateDishReviewDto, @DinerSession() session: IDiningSession): Promise<IHttpResponse<IDishReview>> {
    const review = await this.createDishReviewUsecase.execute(dto, session);
    return buildHttpResponse(review, DISH_REVIEW_SUCCESS_MESSAGES.DISH_REVIEW_CREATED);
  }
}
