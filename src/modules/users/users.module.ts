import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CreateStaffMemberUsecase } from "./application/use-cases/create-staff-member.usecase";
import { FetchAllStaffMembersUsecase } from "./application/use-cases/fetch-all-staff-members.usecase";
import { UpdateStaffMemberUsecase } from "./application/use-cases/update-staff-member.usecase";
import { RestaurantMemberRepository } from "./domain/repositories/restaurant-member.repository";
import { UserRepository } from "./domain/repositories/user.repository";
import RestaurantMemberRepositoryImpl from "./infrastructure/repositories/restaurant-member.repository.impl";
import UserRepositoryImpl from "./infrastructure/repositories/user.repository.impl";
import { StaffMemberController } from "./interfaces/http/staff-member.controller";

@Module({
  imports: [AuditLogsModule],
  controllers: [StaffMemberController],
  providers: [
    CreateStaffMemberUsecase,
    UpdateStaffMemberUsecase,
    FetchAllStaffMembersUsecase,
    UserRepositoryImpl,
    RestaurantMemberRepositoryImpl,
    { provide: UserRepository, useExisting: UserRepositoryImpl },
    { provide: RestaurantMemberRepository, useExisting: RestaurantMemberRepositoryImpl },
  ],
  exports: [
    { provide: UserRepository, useExisting: UserRepositoryImpl },
    { provide: RestaurantMemberRepository, useExisting: RestaurantMemberRepositoryImpl },
  ],
})
export class UsersModule {}
