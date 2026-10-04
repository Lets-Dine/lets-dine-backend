import { forwardRef, Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DishesModule } from "../dishes/dishes.module";
import { ArchiveAddOnUsecase } from "./application/use-cases/archive-add-on.usecase";
import { CreateAddOnUsecase } from "./application/use-cases/create-add-on.usecase";
import { FetchAddOnByIdUsecase } from "./application/use-cases/fetch-add-on-by-id.usecase";
import { FetchAllAddOnsUsecase } from "./application/use-cases/fetch-all-add-ons.usecase";
import { RestoreAddOnUsecase } from "./application/use-cases/restore-add-on.usecase";
import { SetDishAddOnsUsecase } from "./application/use-cases/set-dish-add-ons.usecase";
import { UpdateAddOnUsecase } from "./application/use-cases/update-add-on.usecase";
import { AddOnRepository } from "./domain/repositories/add-on.repository";
import AddOnRepositoryImpl from "./infrastructure/repositories/add-on.repository.impl";
import { AddOnController } from "./interfaces/http/add-on.controller";
import { BillingModule } from "../billing/billing.module";

@Module({
  // DishesModule also depends on this module (FetchDishByIdUsecase needs AddOnRepository
  // to embed a dish's linked add-ons) — a genuine cycle, broken with forwardRef on both sides.
  imports: [AuditLogsModule, BillingModule, forwardRef(() => DishesModule)],
  controllers: [AddOnController],
  providers: [
    CreateAddOnUsecase,
    UpdateAddOnUsecase,
    ArchiveAddOnUsecase,
    RestoreAddOnUsecase,
    FetchAllAddOnsUsecase,
    FetchAddOnByIdUsecase,
    SetDishAddOnsUsecase,
    AddOnRepositoryImpl,
    { provide: AddOnRepository, useExisting: AddOnRepositoryImpl },
  ],
  exports: [SetDishAddOnsUsecase, { provide: AddOnRepository, useExisting: AddOnRepositoryImpl }],
})
export class AddOnsModule {}
