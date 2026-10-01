import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateFloorDto } from "../../application/dto/create-floor.dto";
import { FetchFloorsDto } from "../../application/dto/fetch-floors.dto";
import { UpdateFloorDto } from "../../application/dto/update-floor.dto";
import { CreateFloorUsecase } from "../../application/use-cases/create-floor.usecase";
import { FetchAllFloorsUsecase } from "../../application/use-cases/fetch-all-floors.usecase";
import { RegenerateFloorQrUsecase } from "../../application/use-cases/regenerate-floor-qr.usecase";
import { UpdateFloorUsecase } from "../../application/use-cases/update-floor.usecase";
import { FLOOR_SUCCESS_MESSAGES } from "../../domain/constants";
import { IFloor } from "../../domain/interfaces/floor.interface";

@Controller("restaurant/floors")
export class FloorController {
  constructor(
    private readonly createFloorUsecase: CreateFloorUsecase,
    private readonly updateFloorUsecase: UpdateFloorUsecase,
    private readonly regenerateFloorQrUsecase: RegenerateFloorQrUsecase,
    private readonly fetchAllFloorsUsecase: FetchAllFloorsUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async create(@Body() dto: CreateFloorDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IFloor>> {
    const floor = await this.createFloorUsecase.execute(dto, authEntity);
    return buildHttpResponse(floor, FLOOR_SUCCESS_MESSAGES.FLOOR_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:view"]]))
  async fetchAll(@Query() query: FetchFloorsDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<PaginatedResponse<IFloor>>> {
    const floors = await this.fetchAllFloorsUsecase.execute(query, authEntity);
    return buildHttpResponse(floors, FLOOR_SUCCESS_MESSAGES.FLOORS_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateFloorDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IFloor>> {
    const floor = await this.updateFloorUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(floor, FLOOR_SUCCESS_MESSAGES.FLOOR_UPDATED);
  }

  @Post("/:id/qr")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async regenerateQr(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IFloor>> {
    const floor = await this.regenerateFloorQrUsecase.execute(id, authEntity);
    return buildHttpResponse(floor, FLOOR_SUCCESS_MESSAGES.FLOOR_QR_REGENERATED);
  }
}
