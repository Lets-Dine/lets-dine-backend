import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { UpdateLoyaltyProgramDto } from "../../application/dto/loyalty.dto";
import { GetLoyaltyProgramUsecase } from "../../application/use-cases/get-loyalty-program.usecase";
import { UpdateLoyaltyProgramUsecase } from "../../application/use-cases/update-loyalty-program.usecase";
import { LOYALTY_SUCCESS_MESSAGES } from "../../domain/constants";
import { ILoyaltyProgram } from "../../domain/interfaces/loyalty.interface";

const GUARDS = [AuthGuard, AbilityGuard] as const;

/** The restaurant's points rules, shared by every branch. Anyone who can see settings can read them; the owner changes them. */
@Controller("restaurant/loyalty/program")
export class LoyaltyProgramController {
  constructor(
    private readonly getLoyaltyProgramUsecase: GetLoyaltyProgramUsecase,
    private readonly updateLoyaltyProgramUsecase: UpdateLoyaltyProgramUsecase
  ) {}

  @Get()
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async fetch(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ILoyaltyProgram>> {
    return buildHttpResponse(await this.getLoyaltyProgramUsecase.execute(authEntity), LOYALTY_SUCCESS_MESSAGES.PROGRAM_FETCHED);
  }

  @Put()
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async update(@Body() dto: UpdateLoyaltyProgramDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ILoyaltyProgram>> {
    return buildHttpResponse(await this.updateLoyaltyProgramUsecase.execute(dto, authEntity), LOYALTY_SUCCESS_MESSAGES.PROGRAM_UPDATED);
  }
}
