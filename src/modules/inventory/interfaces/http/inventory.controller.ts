import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import {
  AdjustStockDto,
  ConsumeStockDto,
  CreateIngredientDto,
  FetchBuyListDto,
  FetchPurchasesDto,
  FetchUsageDto,
  FetchQualityDto,
  ReceiveDeliveryDto,
  SetRecipeDto,
  SubmitStockTakeDto,
  TransferStockDto,
  UpdateIngredientDto,
} from "../../application/dto/inventory.dto";
import { AdjustStockUsecase } from "../../application/use-cases/adjust-stock.usecase";
import { ConsumeStockUsecase } from "../../application/use-cases/consume-stock.usecase";
import { CreateIngredientUsecase } from "../../application/use-cases/create-ingredient.usecase";
import { FetchBuyListUsecase } from "../../application/use-cases/fetch-buy-list.usecase";
import { FetchIngredientPurchasesUsecase } from "../../application/use-cases/fetch-ingredient-purchases.usecase";
import { FetchIngredientSummaryUsecase } from "../../application/use-cases/fetch-ingredient-summary.usecase";
import { FetchIngredientUsageUsecase } from "../../application/use-cases/fetch-ingredient-usage.usecase";
import { FetchDeliveryQualityUsecase } from "../../application/use-cases/fetch-delivery-quality.usecase";
import { FetchDishMarginsUsecase } from "../../application/use-cases/fetch-dish-margins.usecase";
import { GetCountSheetUsecase } from "../../application/use-cases/get-count-sheet.usecase";
import { GetRecipeUsecase } from "../../application/use-cases/get-recipe.usecase";
import { ListIngredientsUsecase } from "../../application/use-cases/list-ingredients.usecase";
import { ReceiveDeliveryUsecase } from "../../application/use-cases/receive-delivery.usecase";
import { SetRecipeUsecase } from "../../application/use-cases/set-recipe.usecase";
import { SubmitStockTakeUsecase } from "../../application/use-cases/submit-stock-take.usecase";
import { TransferStockUsecase } from "../../application/use-cases/transfer-stock.usecase";
import { UpdateIngredientUsecase } from "../../application/use-cases/update-ingredient.usecase";
import { INVENTORY_SUCCESS_MESSAGES } from "../../domain/constants";
import {
  IBuyListItem,
  IDishMargin,
  IIngredientSummary,
  IPurchase,
  IUsagePage,
  IIngredient,
  IStockTakeResult,
  ILotQuality,
  IRecipeLine,
} from "../../domain/interfaces/inventory.interface";

const VIEW = [AuthGuard, AbilityGuard] as const;

@Controller("restaurant/inventory")
export class InventoryController {
  constructor(
    private readonly listIngredientsUsecase: ListIngredientsUsecase,
    private readonly createIngredientUsecase: CreateIngredientUsecase,
    private readonly updateIngredientUsecase: UpdateIngredientUsecase,
    private readonly receiveDeliveryUsecase: ReceiveDeliveryUsecase,
    private readonly adjustStockUsecase: AdjustStockUsecase,
    private readonly consumeStockUsecase: ConsumeStockUsecase,
    private readonly getRecipeUsecase: GetRecipeUsecase,
    private readonly setRecipeUsecase: SetRecipeUsecase,
    private readonly fetchDeliveryQualityUsecase: FetchDeliveryQualityUsecase,
    private readonly fetchBuyListUsecase: FetchBuyListUsecase,
    private readonly fetchIngredientUsageUsecase: FetchIngredientUsageUsecase,
    private readonly fetchIngredientSummaryUsecase: FetchIngredientSummaryUsecase,
    private readonly fetchIngredientPurchasesUsecase: FetchIngredientPurchasesUsecase,
    private readonly fetchDishMarginsUsecase: FetchDishMarginsUsecase,
    private readonly getCountSheetUsecase: GetCountSheetUsecase,
    private readonly submitStockTakeUsecase: SubmitStockTakeUsecase,
    private readonly transferStockUsecase: TransferStockUsecase
  ) {}

  @Get("ingredients")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async list(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IIngredient[]>> {
    return buildHttpResponse(await this.listIngredientsUsecase.execute(authEntity), INVENTORY_SUCCESS_MESSAGES.INGREDIENTS_FETCHED);
  }

  @Post("ingredients")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async create(@Body() dto: CreateIngredientDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(await this.createIngredientUsecase.execute(dto, authEntity), INVENTORY_SUCCESS_MESSAGES.INGREDIENT_CREATED);
  }

  @Patch("ingredients/:id")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateIngredientDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(
      await this.updateIngredientUsecase.execute(id, dto, authEntity),
      INVENTORY_SUCCESS_MESSAGES.INGREDIENT_UPDATED
    );
  }

  @Get("ingredients/:id/summary")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async summary(@Param("id") id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IIngredientSummary>> {
    return buildHttpResponse(await this.fetchIngredientSummaryUsecase.execute(id, authEntity), INVENTORY_SUCCESS_MESSAGES.SUMMARY_FETCHED);
  }

  @Get("ingredients/:id/purchases")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async purchases(
    @Param("id") id: string,
    @Query() query: FetchPurchasesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IPurchase[]>> {
    return buildHttpResponse(
      await this.fetchIngredientPurchasesUsecase.execute(id, query, authEntity),
      INVENTORY_SUCCESS_MESSAGES.PURCHASES_FETCHED
    );
  }

  @Get("ingredients/:id/usage")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async usage(
    @Param("id") id: string,
    @Query() query: FetchUsageDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IUsagePage>> {
    return buildHttpResponse(
      await this.fetchIngredientUsageUsecase.execute(id, query, authEntity),
      INVENTORY_SUCCESS_MESSAGES.USAGE_FETCHED
    );
  }

  @Post("ingredients/:id/delivery")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async receiveDelivery(
    @Param("id") id: string,
    @Body() dto: ReceiveDeliveryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(await this.receiveDeliveryUsecase.execute(id, dto, authEntity), INVENTORY_SUCCESS_MESSAGES.DELIVERY_RECEIVED);
  }

  @Post("ingredients/:id/adjust")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async adjust(
    @Param("id") id: string,
    @Body() dto: AdjustStockDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(await this.adjustStockUsecase.execute(id, dto, authEntity), INVENTORY_SUCCESS_MESSAGES.STOCK_ADJUSTED);
  }

  @Post("ingredients/:id/consume")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async consume(
    @Param("id") id: string,
    @Body() dto: ConsumeStockDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(await this.consumeStockUsecase.execute(id, dto, authEntity), INVENTORY_SUCCESS_MESSAGES.STOCK_USED);
  }

  @Get("stock-take/sheet")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async countSheet(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<{ ingredientId: string; name: string; unit: string }[]>> {
    return buildHttpResponse(await this.getCountSheetUsecase.execute(authEntity), INVENTORY_SUCCESS_MESSAGES.SHEET_FETCHED);
  }

  @Post("stock-take")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async stockTake(@Body() dto: SubmitStockTakeDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IStockTakeResult[]>> {
    return buildHttpResponse(await this.submitStockTakeUsecase.execute(dto, authEntity), INVENTORY_SUCCESS_MESSAGES.STOCK_TAKEN);
  }

  @Get("margins")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async margins(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDishMargin[]>> {
    return buildHttpResponse(await this.fetchDishMarginsUsecase.execute(authEntity), INVENTORY_SUCCESS_MESSAGES.MARGINS_FETCHED);
  }

  @Get("buy-list")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async buyList(@Query() query: FetchBuyListDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IBuyListItem[]>> {
    return buildHttpResponse(await this.fetchBuyListUsecase.execute(query, authEntity), INVENTORY_SUCCESS_MESSAGES.BUY_LIST_FETCHED);
  }

  @Get("quality")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async quality(@Query() query: FetchQualityDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ILotQuality[]>> {
    return buildHttpResponse(await this.fetchDeliveryQualityUsecase.execute(query, authEntity), INVENTORY_SUCCESS_MESSAGES.QUALITY_FETCHED);
  }

  @Post("ingredients/:id/transfer")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async transfer(
    @Param("id") id: string,
    @Body() dto: TransferStockDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IIngredient>> {
    return buildHttpResponse(await this.transferStockUsecase.execute(id, dto, authEntity), INVENTORY_SUCCESS_MESSAGES.TRANSFERRED);
  }

  @Get("dishes/:dishId/recipe")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async recipe(@Param("dishId") dishId: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRecipeLine[]>> {
    return buildHttpResponse(await this.getRecipeUsecase.execute(dishId, authEntity), INVENTORY_SUCCESS_MESSAGES.RECIPE_FETCHED);
  }

  @Put("dishes/:dishId/recipe")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async setRecipe(
    @Param("dishId") dishId: string,
    @Body() dto: SetRecipeDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IRecipeLine[]>> {
    return buildHttpResponse(await this.setRecipeUsecase.execute(dishId, dto, authEntity), INVENTORY_SUCCESS_MESSAGES.RECIPE_SAVED);
  }
}
