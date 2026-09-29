import { forwardRef, Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DishesModule } from "../dishes/dishes.module";
import { ArchiveDishVariantUsecase } from "./application/use-cases/archive-dish-variant.usecase";
import { CreateDishVariantUsecase } from "./application/use-cases/create-dish-variant.usecase";
import { FetchDishVariantsUsecase } from "./application/use-cases/fetch-dish-variants.usecase";
import { RestoreDishVariantUsecase } from "./application/use-cases/restore-dish-variant.usecase";
import { UpdateDishVariantUsecase } from "./application/use-cases/update-dish-variant.usecase";
import { DishVariantRepository } from "./domain/repositories/dish-variant.repository";
import DishVariantRepositoryImpl from "./infrastructure/repositories/dish-variant.repository.impl";
import { DishVariantController } from "./interfaces/http/dish-variant.controller";

@Module({
  // DishesModule also depends on this module (FetchDishByIdUsecase needs DishVariantRepository
  // to embed a dish's variants) — a genuine cycle, broken with forwardRef on both sides, same
  // shape as the existing AddOnsModule <-> DishesModule cycle.
  imports: [AuditLogsModule, forwardRef(() => DishesModule)],
  controllers: [DishVariantController],
  providers: [
    CreateDishVariantUsecase,
    UpdateDishVariantUsecase,
    ArchiveDishVariantUsecase,
    RestoreDishVariantUsecase,
    FetchDishVariantsUsecase,
    DishVariantRepositoryImpl,
    { provide: DishVariantRepository, useExisting: DishVariantRepositoryImpl },
  ],
  exports: [{ provide: DishVariantRepository, useExisting: DishVariantRepositoryImpl }],
})
export class DishVariantsModule {}
