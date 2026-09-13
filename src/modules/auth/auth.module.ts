import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AuthTokenService } from "./application/auth-token.service";
import { FetchAuthProfileUsecase } from "./application/use-cases/fetch-auth-profile.usecase";
import { SignInStaffUsecase } from "./application/use-cases/sign-in-staff.usecase";
import { AuthController } from "./interfaces/http/auth.controller";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthTokenService, SignInStaffUsecase, FetchAuthProfileUsecase],
  exports: [AuthTokenService],
})
export class AuthModule {}
