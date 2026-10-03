import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CopyBranchMenuDto } from "../../application/dto/copy-branch-menu.dto";
import { CreateBranchDto } from "../../application/dto/create-branch.dto";
import { FetchBranchesDto } from "../../application/dto/fetch-branches.dto";
import { SetBranchHoursDto } from "../../application/dto/set-branch-hours.dto";
import { UpdateBranchDto } from "../../application/dto/update-branch.dto";
import { CopyBranchMenuUsecase } from "../../application/use-cases/copy-branch-menu.usecase";
import { CreateBranchUsecase } from "../../application/use-cases/create-branch.usecase";
import { FetchAllBranchesUsecase } from "../../application/use-cases/fetch-all-branches.usecase";
import { FetchBranchUsecase } from "../../application/use-cases/fetch-branch.usecase";
import { SetBranchHoursUsecase } from "../../application/use-cases/set-branch-hours.usecase";
import { UpdateBranchUsecase } from "../../application/use-cases/update-branch.usecase";
import { BRANCH_SUCCESS_MESSAGES } from "../../domain/constants";
import { IBranch, IBranchHours, IBranchWithHours } from "../../domain/interfaces/branch.interface";
import { IMenuCopyResult } from "../../domain/repositories/branch-menu.repository";

@Controller("restaurant/branches")
export class BranchController {
  constructor(
    private readonly createBranchUsecase: CreateBranchUsecase,
    private readonly updateBranchUsecase: UpdateBranchUsecase,
    private readonly fetchAllBranchesUsecase: FetchAllBranchesUsecase,
    private readonly fetchBranchUsecase: FetchBranchUsecase,
    private readonly setBranchHoursUsecase: SetBranchHoursUsecase,
    private readonly copyBranchMenuUsecase: CopyBranchMenuUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async create(@Body() dto: CreateBranchDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IBranch>> {
    const branch = await this.createBranchUsecase.execute(dto, authEntity);
    return buildHttpResponse(branch, BRANCH_SUCCESS_MESSAGES.BRANCH_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async fetchAll(@Query() query: FetchBranchesDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<PaginatedResponse<IBranch>>> {
    const branches = await this.fetchAllBranchesUsecase.execute(query, authEntity);
    return buildHttpResponse(branches, BRANCH_SUCCESS_MESSAGES.BRANCHES_FETCHED);
  }

  @Get("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async fetchOne(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IBranchWithHours>> {
    const branch = await this.fetchBranchUsecase.execute(id, authEntity);
    return buildHttpResponse(branch, BRANCH_SUCCESS_MESSAGES.BRANCH_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IBranch>> {
    const branch = await this.updateBranchUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(branch, BRANCH_SUCCESS_MESSAGES.BRANCH_UPDATED);
  }

  /** Starts this branch's menu as a copy of another branch's. Only into an empty menu; the two stay independent afterwards. */
  @Post("/:id/copy-menu")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async copyMenu(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: CopyBranchMenuDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IMenuCopyResult>> {
    const result = await this.copyBranchMenuUsecase.execute(id, dto.fromBranchId, authEntity);
    return buildHttpResponse(result, BRANCH_SUCCESS_MESSAGES.BRANCH_MENU_COPIED);
  }

  @Put("/:id/hours")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async setHours(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: SetBranchHoursDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IBranchHours[]>> {
    const hours = await this.setBranchHoursUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(hours, BRANCH_SUCCESS_MESSAGES.BRANCH_HOURS_UPDATED);
  }
}
