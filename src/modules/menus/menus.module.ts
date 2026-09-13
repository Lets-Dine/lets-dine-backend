import { Module } from "@nestjs/common";
import { DishesModule } from "../dishes/dishes.module";
import { MenuCategoriesModule } from "../menu-categories/menu-categories.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { FetchMenuUsecase } from "./application/use-cases/fetch-menu.usecase";
import { RestaurantRatingRepository } from "./domain/repositories/restaurant-rating.repository";
import RestaurantRatingRepositoryImpl from "./infrastructure/repositories/restaurant-rating.repository.impl";
import { PublicMenuController } from "./interfaces/http/public-menu.controller";

@Module({
  imports: [RestaurantsModule, MenuCategoriesModule, DishesModule],
  controllers: [PublicMenuController],
  providers: [
    FetchMenuUsecase,
    RestaurantRatingRepositoryImpl,
    { provide: RestaurantRatingRepository, useExisting: RestaurantRatingRepositoryImpl },
  ],
  exports: [{ provide: RestaurantRatingRepository, useExisting: RestaurantRatingRepositoryImpl }],
})
export class MenusModule {}
