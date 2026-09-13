// interfaces/http/{feature-name}.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthUser } from "@holista/core/decorators";
import { AbilityGuard, checkPermissionRules, CheckPolicies } from "@holista/core";
import { AuthEntity, IHttpResponse, I{Feature}, PaginatedResponse } from "@holista/core/interfaces";
import { buildHttpResponse } from "@holista/core/utils";
import { Create{Feature}Dto } from "../../application/dto/create-{feature-name}.dto";
import { Update{Feature}Dto } from "../../application/dto/update-{feature-name}.dto";
import { Fetch{Feature}sDto } from "../../application/dto/fetch-{feature-name}s.dto";
import Create{Feature}Usecase from "../../application/use-cases/create-{feature-name}.usecase";
import { Update{Feature}Usecase } from "../../application/use-cases/update-{feature-name}.usecase";
import { FetchAll{Feature}sUsecase } from "../../application/use-cases/fetch-all-{feature-name}s.usecase";
import { SUCCESS_MESSAGES } from "../../domain/constants";

@Controller("{feature-name}s")
export class {Feature}Controller {
  constructor(
    private readonly create{Feature}Usecase: Create{Feature}Usecase,
    private readonly update{Feature}Usecase: Update{Feature}Usecase,
    private readonly fetchAll{Feature}sUsecase: FetchAll{Feature}sUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["add:{feature-name}s"]]))
  async create(@Body() dto: Create{Feature}Dto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<I{Feature}>> {
    const {feature} = await this.create{Feature}Usecase.execute(dto, authEntity);
    return buildHttpResponse({feature}, SUCCESS_MESSAGES.{FEATURE}_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["view:{feature-name}s"]]))
  async fetchAll(@Query() query: Fetch{Feature}sDto): Promise<IHttpResponse<PaginatedResponse<I{Feature}>>> {
    const {feature}s = await this.fetchAll{Feature}sUsecase.execute(query);
    return buildHttpResponse({feature}s, SUCCESS_MESSAGES.{FEATURE}S_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["update:{feature-name}s"]]))
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: Update{Feature}Dto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<I{Feature}>> {
    const {feature} = await this.update{Feature}Usecase.execute(id, dto, authEntity);
    return buildHttpResponse({feature}, SUCCESS_MESSAGES.{FEATURE}_UPDATED);
  }
}
