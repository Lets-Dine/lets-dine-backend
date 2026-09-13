import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { MenuCategoriesModule } from "../menu-categories/menu-categories.module";
import { DishStatsService } from "./application/dish-stats.service";
import { ArchiveDishUsecase } from "./application/use-cases/archive-dish.usecase";
import { CreateDishUsecase } from "./application/use-cases/create-dish.usecase";
import { FetchAllDishesUsecase } from "./application/use-cases/fetch-all-dishes.usecase";
import { FetchDishByIdUsecase } from "./application/use-cases/fetch-dish-by-id.usecase";
import { ReorderDishesUsecase } from "./application/use-cases/reorder-dishes.usecase";
import { RestoreDishUsecase } from "./application/use-cases/restore-dish.usecase";
import { UpdateDishUsecase } from "./application/use-cases/update-dish.usecase";
import { DishRepository } from "./domain/repositories/dish.repository";
import { DishStatsRepository } from "./domain/repositories/dish-stats.repository";
import DishRepositoryImpl from "./infrastructure/repositories/dish.repository.impl";
import DishStatsRepositoryImpl from "./infrastructure/repositories/dish-stats.repository.impl";
import { DishController } from "./interfaces/http/dish.controller";
import { PublicDishController } from "./interfaces/http/public-dish.controller";

@Module({
  imports: [MenuCategoriesModule, AuditLogsModule],
  controllers: [DishController, PublicDishController],
  providers: [
    DishStatsService,
    CreateDishUsecase,
    UpdateDishUsecase,
    ArchiveDishUsecase,
    RestoreDishUsecase,
    ReorderDishesUsecase,
    FetchAllDishesUsecase,
    FetchDishByIdUsecase,
    DishRepositoryImpl,
    DishStatsRepositoryImpl,
    { provide: DishRepository, useExisting: DishRepositoryImpl },
    { provide: DishStatsRepository, useExisting: DishStatsRepositoryImpl },
  ],
  exports: [
    DishStatsService,
    { provide: DishRepository, useExisting: DishRepositoryImpl },
    { provide: DishStatsRepository, useExisting: DishStatsRepositoryImpl },
  ],
})
export class DishesModule {}
