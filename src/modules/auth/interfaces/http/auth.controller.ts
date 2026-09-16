import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthUser } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { SignInStaffDto } from "../../application/dto/sign-in-staff.dto";
import { FetchAuthProfileUsecase } from "../../application/use-cases/fetch-auth-profile.usecase";
import { SignInStaffUsecase } from "../../application/use-cases/sign-in-staff.usecase";
import { AUTH_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAuthProfile, IAuthSession } from "../../domain/interfaces/auth-session.interface";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly signInStaffUsecase: SignInStaffUsecase,
    private readonly fetchAuthProfileUsecase: FetchAuthProfileUsecase
  ) {}

  @Post("/staff/sign-in")
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInStaffDto): Promise<IHttpResponse<IAuthSession>> {
    const session = await this.signInStaffUsecase.execute(dto);
    return buildHttpResponse(session, AUTH_SUCCESS_MESSAGES.SIGNED_IN);
  }

  @Get("/me")
  @UseGuards(AuthGuard)
  async fetchProfile(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAuthProfile>> {
    const profile = await this.fetchAuthProfileUsecase.execute(authEntity);
    return buildHttpResponse(profile, AUTH_SUCCESS_MESSAGES.PROFILE_FETCHED);
  }
}
