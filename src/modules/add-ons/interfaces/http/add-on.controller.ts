import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateAddOnDto } from "../../application/dto/create-add-on.dto";
import { FetchAddOnsDto } from "../../application/dto/fetch-add-ons.dto";
import { UpdateAddOnDto } from "../../application/dto/update-add-on.dto";
import { ArchiveAddOnUsecase } from "../../application/use-cases/archive-add-on.usecase";
import { CreateAddOnUsecase } from "../../application/use-cases/create-add-on.usecase";
import { FetchAddOnByIdUsecase } from "../../application/use-cases/fetch-add-on-by-id.usecase";
import { FetchAllAddOnsUsecase } from "../../application/use-cases/fetch-all-add-ons.usecase";
import { RestoreAddOnUsecase } from "../../application/use-cases/restore-add-on.usecase";
import { UpdateAddOnUsecase } from "../../application/use-cases/update-add-on.usecase";
import { ADD_ON_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";

@Controller("restaurant/add-ons")
@UseGuards(AuthGuard, AbilityGuard)
export class AddOnController {
  constructor(
    private readonly createAddOnUsecase: CreateAddOnUsecase,
    private readonly updateAddOnUsecase: UpdateAddOnUsecase,
    private readonly archiveAddOnUsecase: ArchiveAddOnUsecase,
    private readonly restoreAddOnUsecase: RestoreAddOnUsecase,
    private readonly fetchAllAddOnsUsecase: FetchAllAddOnsUsecase,
    private readonly fetchAddOnByIdUsecase: FetchAddOnByIdUsecase
  ) {}

  @Post()
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async create(@Body() dto: CreateAddOnDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAddOn>> {
    const addOn = await this.createAddOnUsecase.execute(dto, authEntity);
    return buildHttpResponse(addOn, ADD_ON_SUCCESS_MESSAGES.ADD_ON_CREATED);
  }

  @Get()
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchAll(@Query() query: FetchAddOnsDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<PaginatedResponse<IAddOn>>> {
    const addOns = await this.fetchAllAddOnsUsecase.execute(query, authEntity);
    return buildHttpResponse(addOns, ADD_ON_SUCCESS_MESSAGES.ADD_ONS_FETCHED);
  }

  @Get("/:id")
  @CheckPolicies(checkPermissionRules([["menu:view"]]))
  async fetchById(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAddOn>> {
    const addOn = await this.fetchAddOnByIdUsecase.execute(id, authEntity);
    return buildHttpResponse(addOn, ADD_ON_SUCCESS_MESSAGES.ADD_ON_FETCHED);
  }

  @Patch("/:id")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateAddOnDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IAddOn>> {
    const addOn = await this.updateAddOnUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(addOn, ADD_ON_SUCCESS_MESSAGES.ADD_ON_UPDATED);
  }

  @Post("/:id/archive")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async archive(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAddOn>> {
    const addOn = await this.archiveAddOnUsecase.execute(id, authEntity);
    return buildHttpResponse(addOn, ADD_ON_SUCCESS_MESSAGES.ADD_ON_ARCHIVED);
  }

  @Post("/:id/restore")
  @CheckPolicies(checkPermissionRules([["menu:edit"]]))
  async restore(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAddOn>> {
    const addOn = await this.restoreAddOnUsecase.execute(id, authEntity);
    return buildHttpResponse(addOn, ADD_ON_SUCCESS_MESSAGES.ADD_ON_RESTORED);
  }
}
