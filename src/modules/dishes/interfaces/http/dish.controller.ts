import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateDishDto } from "../../application/dto/create-dish.dto";
import { FetchDishesDto } from "../../application/dto/fetch-dishes.dto";
import { ReorderDishesDto } from "../../application/dto/reorder-dishes.dto";
import { UpdateDishDto } from "../../application/dto/update-dish.dto";
import { ArchiveDishUsecase } from "../../application/use-cases/archive-dish.usecase";
import { CreateDishUsecase } from "../../application/use-cases/create-dish.usecase";
import { FetchAllDishesUsecase } from "../../application/use-cases/fetch-all-dishes.usecase";
import { FetchDishByIdUsecase } from "../../application/use-cases/fetch-dish-by-id.usecase";
import { ReorderDishesUsecase } from "../../application/use-cases/reorder-dishes.usecase";
import { RestoreDishUsecase } from "../../application/use-cases/restore-dish.usecase";
import { UpdateDishUsecase } from "../../application/use-cases/update-dish.usecase";
import { DISH_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDish } from "../../domain/interfaces/dish.interface";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";

@Controller("restaurant/dishes")
export class DishController {
  constructor(
    private readonly createDishUsecase: CreateDishUsecase,
    private readonly updateDishUsecase: UpdateDishUsecase,
    private readonly archiveDishUsecase: ArchiveDishUsecase,
    private readonly restoreDishUsecase: RestoreDishUsecase,
    private readonly reorderDishesUsecase: ReorderDishesUsecase,
    private readonly fetchAllDishesUsecase: FetchAllDishesUsecase,
    private readonly fetchDishByIdUsecase: FetchDishByIdUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async create(@Body() dto: CreateDishDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDish>> {
    const dish = await this.createDishUsecase.execute(dto, authEntity);
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchAll(
    @Query() query: FetchDishesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IDishWithStats>>> {
    const dishes = await this.fetchAllDishesUsecase.execute(query, authEntity);
    return buildHttpResponse(dishes, DISH_SUCCESS_MESSAGES.DISHES_FETCHED);
  }

  @Patch("/reorder")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async reorder(@Body() dto: ReorderDishesDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDish[]>> {
    const dishes = await this.reorderDishesUsecase.execute(dto, authEntity);
    return buildHttpResponse(dishes, DISH_SUCCESS_MESSAGES.DISHES_REORDERED);
  }

  @Get("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchById(@Param("id", ParseUuidPipe) id: string): Promise<IHttpResponse<IDishWithStats>> {
    const dish = await this.fetchDishByIdUsecase.execute(id, { includeArchived: true });
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateDishDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDish>> {
    const dish = await this.updateDishUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_UPDATED);
  }

  @Post("/:id/archive")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async archive(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDish>> {
    const dish = await this.archiveDishUsecase.execute(id, authEntity);
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_ARCHIVED);
  }

  @Post("/:id/restore")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async restore(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDish>> {
    const dish = await this.restoreDishUsecase.execute(id, authEntity);
    return buildHttpResponse(dish, DISH_SUCCESS_MESSAGES.DISH_RESTORED);
  }
}
