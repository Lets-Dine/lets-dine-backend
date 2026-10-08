import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AllowWhenSuspended, AuthGuard, AuthUser } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { SignUpDto } from "../../application/dto/sign-up.dto";
import { SwitchBranchDto } from "../../application/dto/switch-branch.dto";
import { SignInStaffDto } from "../../application/dto/sign-in-staff.dto";
import { FetchAuthProfileUsecase } from "../../application/use-cases/fetch-auth-profile.usecase";
import { SignInStaffUsecase } from "../../application/use-cases/sign-in-staff.usecase";
import { SignUpUsecase } from "../../application/use-cases/sign-up.usecase";
import { SwitchBranchUsecase } from "../../application/use-cases/switch-branch.usecase";
import { AUTH_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAuthProfile, IAuthSession, IAuthSwitch } from "../../domain/interfaces/auth-session.interface";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly signInStaffUsecase: SignInStaffUsecase,
    private readonly signUpUsecase: SignUpUsecase,
    private readonly fetchAuthProfileUsecase: FetchAuthProfileUsecase,
    private readonly switchBranchUsecase: SwitchBranchUsecase
  ) {}

  // ponytail: per-IP, in-memory counters (per instance); move to a shared store if the API scales out. Behind a proxy, enable `trust proxy`.
  @Post("/signup")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async signUp(@Body() dto: SignUpDto): Promise<IHttpResponse<IAuthSession>> {
    const session = await this.signUpUsecase.execute(dto);
    return buildHttpResponse(session, AUTH_SUCCESS_MESSAGES.SIGNED_IN);
  }

  @Post("/staff/sign-in")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInStaffDto): Promise<IHttpResponse<IAuthSession>> {
    const session = await this.signInStaffUsecase.execute(dto);
    return buildHttpResponse(session, AUTH_SUCCESS_MESSAGES.SIGNED_IN);
  }

  @Post("/staff/switch-branch")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async switchBranch(@Body() dto: SwitchBranchDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAuthSwitch>> {
    const session = await this.switchBranchUsecase.execute(dto, authEntity);
    return buildHttpResponse(session, AUTH_SUCCESS_MESSAGES.BRANCH_SWITCHED);
  }

  // An owner of a suspended restaurant still needs this to render the dashboard that leads to billing.
  @Get("/me")
  @AllowWhenSuspended()
  @UseGuards(AuthGuard)
  async fetchProfile(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAuthProfile>> {
    const profile = await this.fetchAuthProfileUsecase.execute(authEntity);
    return buildHttpResponse(profile, AUTH_SUCCESS_MESSAGES.PROFILE_FETCHED);
  }
}
