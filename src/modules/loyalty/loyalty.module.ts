import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { LoyaltyService } from "./application/loyalty.service";
import { AdjustLoyaltyUsecase } from "./application/use-cases/adjust-loyalty.usecase";
import { GetOrderLoyaltyUsecase } from "./application/use-cases/get-order-loyalty.usecase";
import { GetCustomerLoyaltyUsecase } from "./application/use-cases/get-customer-loyalty.usecase";
import { GetLoyaltyProgramUsecase } from "./application/use-cases/get-loyalty-program.usecase";
import { UpdateLoyaltyProgramUsecase } from "./application/use-cases/update-loyalty-program.usecase";
import { LoyaltyRepository } from "./domain/repositories/loyalty.repository";
import LoyaltyRepositoryImpl from "./infrastructure/repositories/loyalty.repository.impl";
import { PublicLoyaltyController } from "./interfaces/http/public-loyalty.controller";
import { LoyaltyProgramController } from "./interfaces/http/loyalty-program.controller";
import { LoyaltyController } from "./interfaces/http/loyalty.controller";

@Module({
  imports: [AuditLogsModule, DiningSessionsModule],
  controllers: [LoyaltyController, LoyaltyProgramController, PublicLoyaltyController],
  providers: [
    LoyaltyService,
    GetCustomerLoyaltyUsecase,
    GetOrderLoyaltyUsecase,
    AdjustLoyaltyUsecase,
    GetLoyaltyProgramUsecase,
    UpdateLoyaltyProgramUsecase,
    LoyaltyRepositoryImpl,
    { provide: LoyaltyRepository, useExisting: LoyaltyRepositoryImpl },
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
