import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PublicBranchService } from "./application/public-branch.service";
import { CopyBranchMenuUsecase } from "./application/use-cases/copy-branch-menu.usecase";
import { CreateBranchUsecase } from "./application/use-cases/create-branch.usecase";
import { FetchAllBranchesUsecase } from "./application/use-cases/fetch-all-branches.usecase";
import { FetchBranchUsecase } from "./application/use-cases/fetch-branch.usecase";
import { SetBranchHoursUsecase } from "./application/use-cases/set-branch-hours.usecase";
import { UpdateBranchUsecase } from "./application/use-cases/update-branch.usecase";
import { BranchRepository } from "./domain/repositories/branch.repository";
import { BranchMenuRepository } from "./domain/repositories/branch-menu.repository";
import BranchMenuRepositoryImpl from "./infrastructure/repositories/branch-menu.repository.impl";
import BranchRepositoryImpl from "./infrastructure/repositories/branch.repository.impl";
import { BranchController } from "./interfaces/http/branch.controller";

@Module({
  imports: [AuditLogsModule],
  controllers: [BranchController],
  providers: [
    CreateBranchUsecase,
    CopyBranchMenuUsecase,
    BranchMenuRepositoryImpl,
    { provide: BranchMenuRepository, useExisting: BranchMenuRepositoryImpl },
    UpdateBranchUsecase,
    FetchAllBranchesUsecase,
    FetchBranchUsecase,
    SetBranchHoursUsecase,
    PublicBranchService,
    BranchRepositoryImpl,
    { provide: BranchRepository, useExisting: BranchRepositoryImpl },
  ],
  exports: [
    PublicBranchService,
    { provide: BranchRepository, useExisting: BranchRepositoryImpl },
  ],
})
export class BranchesModule {}
