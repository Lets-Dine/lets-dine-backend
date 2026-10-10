import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BillingModule } from "../billing/billing.module";
import { InventoryService } from "./application/inventory.service";
import { AdjustStockUsecase } from "./application/use-cases/adjust-stock.usecase";
import { ConsumeStockUsecase } from "./application/use-cases/consume-stock.usecase";
import { CreateIngredientUsecase } from "./application/use-cases/create-ingredient.usecase";
import { FetchIngredientPurchasesUsecase } from "./application/use-cases/fetch-ingredient-purchases.usecase";
import { FetchIngredientSummaryUsecase } from "./application/use-cases/fetch-ingredient-summary.usecase";
import { FetchIngredientUsageUsecase } from "./application/use-cases/fetch-ingredient-usage.usecase";
import { FetchBuyListUsecase } from "./application/use-cases/fetch-buy-list.usecase";
import { FetchDeliveryQualityUsecase } from "./application/use-cases/fetch-delivery-quality.usecase";
import { FetchDishMarginsUsecase } from "./application/use-cases/fetch-dish-margins.usecase";
import { GetCountSheetUsecase } from "./application/use-cases/get-count-sheet.usecase";
import { GetRecipeUsecase } from "./application/use-cases/get-recipe.usecase";
import { ListIngredientsUsecase } from "./application/use-cases/list-ingredients.usecase";
import { ReceiveDeliveryUsecase } from "./application/use-cases/receive-delivery.usecase";
import { SetRecipeUsecase } from "./application/use-cases/set-recipe.usecase";
import { SubmitStockTakeUsecase } from "./application/use-cases/submit-stock-take.usecase";
import { TransferStockUsecase } from "./application/use-cases/transfer-stock.usecase";
import { UpdateIngredientUsecase } from "./application/use-cases/update-ingredient.usecase";
import { InventoryRepository } from "./domain/repositories/inventory.repository";
import InventoryRepositoryImpl from "./infrastructure/repositories/inventory.repository.impl";
import { InventoryController } from "./interfaces/http/inventory.controller";

@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    ListIngredientsUsecase,
    CreateIngredientUsecase,
    UpdateIngredientUsecase,
    ReceiveDeliveryUsecase,
    AdjustStockUsecase,
    ConsumeStockUsecase,
    GetRecipeUsecase,
    FetchDeliveryQualityUsecase,
    FetchBuyListUsecase,
    FetchIngredientUsageUsecase,
    FetchIngredientSummaryUsecase,
    FetchIngredientPurchasesUsecase,
    FetchDishMarginsUsecase,
    GetCountSheetUsecase,
    SubmitStockTakeUsecase,
    TransferStockUsecase,
    SetRecipeUsecase,
    InventoryRepositoryImpl,
    { provide: InventoryRepository, useExisting: InventoryRepositoryImpl },
  ],
  // Orders calls `InventoryService.consumeForItem` inside its own transaction.
  exports: [InventoryService],
})
export class InventoryModule {}
