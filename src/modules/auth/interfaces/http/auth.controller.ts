import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AllowWhenSuspended, AuthGuard, AuthUser } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { DeleteOwnAccountDto } from "../../application/dto/delete-own-account.dto";
import { DeleteOwnAccountUsecase } from "../../application/use-cases/delete-own-account.usecase";
import { SignUpDto } from "../../application/dto/sign-up.dto";
import { SetApprovalPinDto } from "../../application/dto/set-approval-pin.dto";
import { SetApprovalPinUsecase } from "../../application/use-cases/set-approval-pin.usecase";
import { ChangeOwnPinDto } from "../../application/dto/change-own-pin.dto";
import { UpdateOwnProfileDto } from "../../application/dto/update-own-profile.dto";
import { ChangeOwnPinUsecase } from "../../application/use-cases/change-own-pin.usecase";
import { UpdateOwnProfileUsecase } from "../../application/use-cases/update-own-profile.usecase";
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
    private readonly switchBranchUsecase: SwitchBranchUsecase,
    private readonly updateOwnProfileUsecase: UpdateOwnProfileUsecase,
    private readonly changeOwnPinUsecase: ChangeOwnPinUsecase,
    private readonly setApprovalPinUsecase: SetApprovalPinUsecase,
    private readonly deleteOwnAccountUsecase: DeleteOwnAccountUsecase
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

  @Patch("/me")
  @UseGuards(AuthGuard)
  async updateProfile(
    @Body() dto: UpdateOwnProfileDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<{ name: string; phone: string | null; avatarUrl: string | null }>> {
    const updated = await this.updateOwnProfileUsecase.execute(dto, authEntity);
    return buildHttpResponse(updated, AUTH_SUCCESS_MESSAGES.PROFILE_UPDATED);
  }

  // Throttled like sign-in: a stolen session must not be able to guess the current PIN.
  @Post("/me/pin")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async changePin(@Body() dto: ChangeOwnPinDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.changeOwnPinUsecase.execute(dto, authEntity);
    return buildHttpResponse(null, AUTH_SUCCESS_MESSAGES.PIN_CHANGED);
  }

  // Open to an owner even while the restaurant is suspended. Other staff are locked out by billing like every other route, so they still need the web deletion path.
  // Throttled like the PIN change: it takes the sign-in PIN, which a stolen session must not be able to guess.
  @Delete("/me")
  @HttpCode(HttpStatus.OK)
  @AllowWhenSuspended()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async deleteAccount(@Body() dto: DeleteOwnAccountDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.deleteOwnAccountUsecase.execute(dto, authEntity);
    return buildHttpResponse(null, AUTH_SUCCESS_MESSAGES.ACCOUNT_DELETED);
  }

  // Throttled like the sign-in PIN change: it takes the sign-in PIN, which a stolen session must not be able to guess.
  @Post("/me/approval-pin")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async setApprovalPin(@Body() dto: SetApprovalPinDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.setApprovalPinUsecase.execute(dto, authEntity);
    return buildHttpResponse(null, AUTH_SUCCESS_MESSAGES.APPROVAL_PIN_SET);
  }
}
