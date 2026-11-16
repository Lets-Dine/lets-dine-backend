import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BranchesModule } from "../branches/branches.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { UsersModule } from "../users/users.module";
import { AuthTokenService } from "./application/auth-token.service";
import { SetApprovalPinUsecase } from "./application/use-cases/set-approval-pin.usecase";
import { ChangeOwnPinUsecase } from "./application/use-cases/change-own-pin.usecase";
import { UpdateOwnProfileUsecase } from "./application/use-cases/update-own-profile.usecase";
import { FetchAuthProfileUsecase } from "./application/use-cases/fetch-auth-profile.usecase";
import { SignInStaffUsecase } from "./application/use-cases/sign-in-staff.usecase";
import { SignUpUsecase } from "./application/use-cases/sign-up.usecase";
import { SwitchBranchUsecase } from "./application/use-cases/switch-branch.usecase";
import { BranchScopeService } from "./application/branch-scope.service";
import { AuthController } from "./interfaces/http/auth.controller";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]), UsersModule, BranchesModule, RestaurantsModule, AuditLogsModule],
  controllers: [AuthController],
  providers: [AuthTokenService, BranchScopeService, SignInStaffUsecase, SignUpUsecase, SwitchBranchUsecase, FetchAuthProfileUsecase, UpdateOwnProfileUsecase, ChangeOwnPinUsecase, SetApprovalPinUsecase],
  exports: [AuthTokenService],
})
export class AuthModule {}
