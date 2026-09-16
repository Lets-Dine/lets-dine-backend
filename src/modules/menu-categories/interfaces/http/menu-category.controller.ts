import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateMenuCategoryDto } from "../../application/dto/create-menu-category.dto";
import { FetchMenuCategoriesDto } from "../../application/dto/fetch-menu-categories.dto";
import { ReorderMenuCategoriesDto } from "../../application/dto/reorder-menu-categories.dto";
import { UpdateMenuCategoryDto } from "../../application/dto/update-menu-category.dto";
import { CreateMenuCategoryUsecase } from "../../application/use-cases/create-menu-category.usecase";
import { DeleteMenuCategoryUsecase } from "../../application/use-cases/delete-menu-category.usecase";
import { FetchAllMenuCategoriesUsecase } from "../../application/use-cases/fetch-all-menu-categories.usecase";
import { ReorderMenuCategoriesUsecase } from "../../application/use-cases/reorder-menu-categories.usecase";
import { UpdateMenuCategoryUsecase } from "../../application/use-cases/update-menu-category.usecase";
import { MENU_CATEGORY_SUCCESS_MESSAGES } from "../../domain/constants";
import { IMenuCategory } from "../../domain/interfaces/menu-category.interface";

@Controller("restaurant/categories")
export class MenuCategoryController {
  constructor(
    private readonly createMenuCategoryUsecase: CreateMenuCategoryUsecase,
    private readonly updateMenuCategoryUsecase: UpdateMenuCategoryUsecase,
    private readonly deleteMenuCategoryUsecase: DeleteMenuCategoryUsecase,
    private readonly reorderMenuCategoriesUsecase: ReorderMenuCategoriesUsecase,
    private readonly fetchAllMenuCategoriesUsecase: FetchAllMenuCategoriesUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async create(@Body() dto: CreateMenuCategoryDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IMenuCategory>> {
    const category = await this.createMenuCategoryUsecase.execute(dto, authEntity);
    return buildHttpResponse(category, MENU_CATEGORY_SUCCESS_MESSAGES.MENU_CATEGORY_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchAll(
    @Query() query: FetchMenuCategoriesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IMenuCategory>>> {
    const categories = await this.fetchAllMenuCategoriesUsecase.execute(query, authEntity);
    return buildHttpResponse(categories, MENU_CATEGORY_SUCCESS_MESSAGES.MENU_CATEGORIES_FETCHED);
  }

  @Patch("/reorder")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async reorder(@Body() dto: ReorderMenuCategoriesDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IMenuCategory[]>> {
    const categories = await this.reorderMenuCategoriesUsecase.execute(dto, authEntity);
    return buildHttpResponse(categories, MENU_CATEGORY_SUCCESS_MESSAGES.MENU_CATEGORIES_REORDERED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateMenuCategoryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IMenuCategory>> {
    const category = await this.updateMenuCategoryUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(category, MENU_CATEGORY_SUCCESS_MESSAGES.MENU_CATEGORY_UPDATED);
  }

  @Delete("/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async delete(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.deleteMenuCategoryUsecase.execute(id, authEntity);
    return buildHttpResponse(null, MENU_CATEGORY_SUCCESS_MESSAGES.MENU_CATEGORY_DELETED);
  }
}
