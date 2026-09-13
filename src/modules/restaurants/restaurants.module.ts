import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { UsersModule } from "../users/users.module";
import { FetchAllRestaurantsUsecase } from "./application/use-cases/fetch-all-restaurants.usecase";
import { FetchRestaurantBySlugUsecase } from "./application/use-cases/fetch-restaurant-by-slug.usecase";
import { FetchRestaurantProfileUsecase } from "./application/use-cases/fetch-restaurant-profile.usecase";
import { RegisterRestaurantUsecase } from "./application/use-cases/register-restaurant.usecase";
import { UpdateRestaurantUsecase } from "./application/use-cases/update-restaurant.usecase";
import { RestaurantRepository } from "./domain/repositories/restaurant.repository";
import RestaurantRepositoryImpl from "./infrastructure/repositories/restaurant.repository.impl";
import { PlatformRestaurantController } from "./interfaces/http/platform-restaurant.controller";
import { PublicRestaurantController } from "./interfaces/http/public-restaurant.controller";
import { RestaurantController } from "./interfaces/http/restaurant.controller";

@Module({
  imports: [UsersModule, AuditLogsModule],
  controllers: [PublicRestaurantController, RestaurantController, PlatformRestaurantController],
  providers: [
    RegisterRestaurantUsecase,
    FetchRestaurantBySlugUsecase,
    FetchRestaurantProfileUsecase,
    UpdateRestaurantUsecase,
    FetchAllRestaurantsUsecase,
    RestaurantRepositoryImpl,
    { provide: RestaurantRepository, useExisting: RestaurantRepositoryImpl },
  ],
  exports: [{ provide: RestaurantRepository, useExisting: RestaurantRepositoryImpl }],
})
export class RestaurantsModule {}
