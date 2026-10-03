import { Module } from "@nestjs/common";
import { BranchesModule } from "../branches/branches.module";
import { UsersModule } from "../users/users.module";
import { AuthTokenService } from "./application/auth-token.service";
import { FetchAuthProfileUsecase } from "./application/use-cases/fetch-auth-profile.usecase";
import { SignInStaffUsecase } from "./application/use-cases/sign-in-staff.usecase";
import { SwitchBranchUsecase } from "./application/use-cases/switch-branch.usecase";
import { BranchScopeService } from "./application/branch-scope.service";
import { AuthController } from "./interfaces/http/auth.controller";

@Module({
  imports: [UsersModule, BranchesModule],
  controllers: [AuthController],
  providers: [AuthTokenService, BranchScopeService, SignInStaffUsecase, SwitchBranchUsecase, FetchAuthProfileUsecase],
  exports: [AuthTokenService],
})
export class AuthModule {}
