import { Module } from "@nestjs/common";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { OrdersModule } from "../orders/orders.module";
import { CreateDishReviewUsecase } from "./application/use-cases/create-dish-review.usecase";
import { FetchDishReviewsUsecase } from "./application/use-cases/fetch-dish-reviews.usecase";
import { FetchDishTagsUsecase } from "./application/use-cases/fetch-dish-tags.usecase";
import { FetchRestaurantReviewsUsecase } from "./application/use-cases/fetch-restaurant-reviews.usecase";
import { DishReviewRepository } from "./domain/repositories/dish-review.repository";
import { DishTagRepository } from "./domain/repositories/dish-tag.repository";
import DishReviewRepositoryImpl from "./infrastructure/repositories/dish-review.repository.impl";
import DishTagRepositoryImpl from "./infrastructure/repositories/dish-tag.repository.impl";
import { PublicReviewController } from "./interfaces/http/public-review.controller";
import { RestaurantReviewController } from "./interfaces/http/restaurant-review.controller";

@Module({
  imports: [DiningSessionsModule, OrdersModule],
  controllers: [PublicReviewController, RestaurantReviewController],
  providers: [
    CreateDishReviewUsecase,
    FetchDishReviewsUsecase,
    FetchRestaurantReviewsUsecase,
    FetchDishTagsUsecase,
    DishReviewRepositoryImpl,
    DishTagRepositoryImpl,
    { provide: DishReviewRepository, useExisting: DishReviewRepositoryImpl },
    { provide: DishTagRepository, useExisting: DishTagRepositoryImpl },
  ],
  exports: [
    { provide: DishReviewRepository, useExisting: DishReviewRepositoryImpl },
    { provide: DishTagRepository, useExisting: DishTagRepositoryImpl },
  ],
})
export class ReviewsModule {}
