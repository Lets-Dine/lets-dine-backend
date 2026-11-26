import { Global, Module } from "@nestjs/common";
import { StaffMembershipPolicy } from "../../common/auth";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BranchesModule } from "../branches/branches.module";
import { ActiveMembershipPolicy } from "./application/active-membership.policy";
import { CreateStaffMemberUsecase } from "./application/use-cases/create-staff-member.usecase";
import { FetchAllStaffMembersUsecase } from "./application/use-cases/fetch-all-staff-members.usecase";
import { UpdateStaffMemberUsecase } from "./application/use-cases/update-staff-member.usecase";
import { RestaurantMemberRepository } from "./domain/repositories/restaurant-member.repository";
import { UserRepository } from "./domain/repositories/user.repository";
import RestaurantMemberRepositoryImpl from "./infrastructure/repositories/restaurant-member.repository.impl";
import UserRepositoryImpl from "./infrastructure/repositories/user.repository.impl";
import { StaffMemberController } from "./interfaces/http/staff-member.controller";
import { BillingModule } from "../billing/billing.module";

// Global because AuthGuard, used by nearly every module, asks StaffMembershipPolicy whether the token's membership is still live.
@Global()
@Module({
  imports: [AuditLogsModule, BranchesModule, BillingModule],
  controllers: [StaffMemberController],
  providers: [
    CreateStaffMemberUsecase,
    UpdateStaffMemberUsecase,
    FetchAllStaffMembersUsecase,
    UserRepositoryImpl,
    RestaurantMemberRepositoryImpl,
    { provide: UserRepository, useExisting: UserRepositoryImpl },
    { provide: RestaurantMemberRepository, useExisting: RestaurantMemberRepositoryImpl },
    { provide: StaffMembershipPolicy, useClass: ActiveMembershipPolicy },
  ],
  exports: [
    { provide: UserRepository, useExisting: UserRepositoryImpl },
    { provide: RestaurantMemberRepository, useExisting: RestaurantMemberRepositoryImpl },
    StaffMembershipPolicy,
  ],
})
export class UsersModule {}
