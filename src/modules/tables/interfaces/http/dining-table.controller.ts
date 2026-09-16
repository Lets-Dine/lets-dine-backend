import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateTableDto } from "../../application/dto/create-table.dto";
import { FetchTablesDto } from "../../application/dto/fetch-tables.dto";
import { UpdateTableDto } from "../../application/dto/update-table.dto";
import { CreateTableUsecase } from "../../application/use-cases/create-table.usecase";
import { FetchAllTablesUsecase } from "../../application/use-cases/fetch-all-tables.usecase";
import { RegenerateTableQrUsecase } from "../../application/use-cases/regenerate-table-qr.usecase";
import { UpdateTableUsecase } from "../../application/use-cases/update-table.usecase";
import { DINING_TABLE_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";

@Controller("restaurant/tables")
export class DiningTableController {
  constructor(
    private readonly createTableUsecase: CreateTableUsecase,
    private readonly updateTableUsecase: UpdateTableUsecase,
    private readonly regenerateTableQrUsecase: RegenerateTableQrUsecase,
    private readonly fetchAllTablesUsecase: FetchAllTablesUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async create(@Body() dto: CreateTableDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.createTableUsecase.execute(dto, authEntity);
    return buildHttpResponse(table, DINING_TABLE_SUCCESS_MESSAGES.DINING_TABLE_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:view"]]))
  async fetchAll(
    @Query() query: FetchTablesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IDiningTable>>> {
    const tables = await this.fetchAllTablesUsecase.execute(query, authEntity);
    return buildHttpResponse(tables, DINING_TABLE_SUCCESS_MESSAGES.DINING_TABLES_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateTableDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.updateTableUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(table, DINING_TABLE_SUCCESS_MESSAGES.DINING_TABLE_UPDATED);
  }

  @Post("/:id/qr")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async regenerateQr(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.regenerateTableQrUsecase.execute(id, authEntity);
    return buildHttpResponse(table, DINING_TABLE_SUCCESS_MESSAGES.DINING_TABLE_QR_REGENERATED);
  }
}
