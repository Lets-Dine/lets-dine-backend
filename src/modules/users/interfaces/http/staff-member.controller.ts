import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateStaffMemberDto } from "../../application/dto/create-staff-member.dto";
import { FetchStaffMembersDto } from "../../application/dto/fetch-staff-members.dto";
import { UpdateStaffMemberDto } from "../../application/dto/update-staff-member.dto";
import { CreateStaffMemberUsecase } from "../../application/use-cases/create-staff-member.usecase";
import { FetchAllStaffMembersUsecase } from "../../application/use-cases/fetch-all-staff-members.usecase";
import { UpdateStaffMemberUsecase } from "../../application/use-cases/update-staff-member.usecase";
import { STAFF_MEMBER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IStaffMember } from "../../domain/interfaces/restaurant-member.interface";

@Controller("restaurant/staff")
export class StaffMemberController {
  constructor(
    private readonly createStaffMemberUsecase: CreateStaffMemberUsecase,
    private readonly updateStaffMemberUsecase: UpdateStaffMemberUsecase,
    private readonly fetchAllStaffMembersUsecase: FetchAllStaffMembersUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async create(@Body() dto: CreateStaffMemberDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IStaffMember>> {
    const staffMember = await this.createStaffMemberUsecase.execute(dto, authEntity);
    return buildHttpResponse(staffMember, STAFF_MEMBER_SUCCESS_MESSAGES.STAFF_MEMBER_CREATED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async fetchAll(
    @Query() query: FetchStaffMembersDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IStaffMember>>> {
    const staffMembers = await this.fetchAllStaffMembersUsecase.execute(query, authEntity);
    return buildHttpResponse(staffMembers, STAFF_MEMBER_SUCCESS_MESSAGES.STAFF_MEMBERS_FETCHED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateStaffMemberDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IStaffMember>> {
    const staffMember = await this.updateStaffMemberUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(staffMember, STAFF_MEMBER_SUCCESS_MESSAGES.STAFF_MEMBER_UPDATED);
  }
}
