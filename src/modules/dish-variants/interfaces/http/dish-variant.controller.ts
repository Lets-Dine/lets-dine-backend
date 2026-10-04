import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateDishVariantDto } from "../../application/dto/create-dish-variant.dto";
import { UpdateDishVariantDto } from "../../application/dto/update-dish-variant.dto";
import { ArchiveDishVariantUsecase } from "../../application/use-cases/archive-dish-variant.usecase";
import { CreateDishVariantUsecase } from "../../application/use-cases/create-dish-variant.usecase";
import { FetchDishVariantsUsecase } from "../../application/use-cases/fetch-dish-variants.usecase";
import { RestoreDishVariantUsecase } from "../../application/use-cases/restore-dish-variant.usecase";
import { UpdateDishVariantUsecase } from "../../application/use-cases/update-dish-variant.usecase";
import { DISH_VARIANT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import { SubscriptionActiveGuard } from "../../../billing/interfaces/http/guards/subscription-active.guard";

@Controller("restaurant/dishes/:dishId/variants")
@UseGuards(AuthGuard, AbilityGuard, SubscriptionActiveGuard)
export class DishVariantController {
  constructor(
    private readonly createDishVariantUsecase: CreateDishVariantUsecase,
    private readonly updateDishVariantUsecase: UpdateDishVariantUsecase,
    private readonly archiveDishVariantUsecase: ArchiveDishVariantUsecase,
    private readonly restoreDishVariantUsecase: RestoreDishVariantUsecase,
    private readonly fetchDishVariantsUsecase: FetchDishVariantsUsecase
  ) {}

  @Post()
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async create(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @Body() dto: CreateDishVariantDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDishVariant>> {
    const variant = await this.createDishVariantUsecase.execute(dishId, dto, authEntity);
    return buildHttpResponse(variant, DISH_VARIANT_SUCCESS_MESSAGES.DISH_VARIANT_CREATED);
  }

  @Get()
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchAll(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDishVariant[]>> {
    const variants = await this.fetchDishVariantsUsecase.execute(dishId, authEntity);
    return buildHttpResponse(variants, DISH_VARIANT_SUCCESS_MESSAGES.DISH_VARIANTS_FETCHED);
  }

  @Patch("/:variantId")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async update(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @Param("variantId", ParseUuidPipe) variantId: string,
    @Body() dto: UpdateDishVariantDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDishVariant>> {
    const variant = await this.updateDishVariantUsecase.execute(dishId, variantId, dto, authEntity);
    return buildHttpResponse(variant, DISH_VARIANT_SUCCESS_MESSAGES.DISH_VARIANT_UPDATED);
  }

  @Post("/:variantId/archive")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async archive(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @Param("variantId", ParseUuidPipe) variantId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDishVariant>> {
    const variant = await this.archiveDishVariantUsecase.execute(dishId, variantId, authEntity);
    return buildHttpResponse(variant, DISH_VARIANT_SUCCESS_MESSAGES.DISH_VARIANT_ARCHIVED);
  }

  @Post("/:variantId/restore")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async restore(
    @Param("dishId", ParseUuidPipe) dishId: string,
    @Param("variantId", ParseUuidPipe) variantId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDishVariant>> {
    const variant = await this.restoreDishVariantUsecase.execute(dishId, variantId, authEntity);
    return buildHttpResponse(variant, DISH_VARIANT_SUCCESS_MESSAGES.DISH_VARIANT_RESTORED);
  }
}
