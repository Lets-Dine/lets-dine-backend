import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CreateFloorUsecase } from "./application/use-cases/create-floor.usecase";
import { FetchAllFloorsUsecase } from "./application/use-cases/fetch-all-floors.usecase";
import { RegenerateFloorQrUsecase } from "./application/use-cases/regenerate-floor-qr.usecase";
import { UpdateFloorUsecase } from "./application/use-cases/update-floor.usecase";
import { FloorRepository } from "./domain/repositories/floor.repository";
import FloorRepositoryImpl from "./infrastructure/repositories/floor.repository.impl";
import { FloorController } from "./interfaces/http/floor.controller";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [FloorController],
  providers: [
    CreateFloorUsecase,
    UpdateFloorUsecase,
    RegenerateFloorQrUsecase,
    FetchAllFloorsUsecase,
    FloorRepositoryImpl,
    { provide: FloorRepository, useExisting: FloorRepositoryImpl },
  ],
  exports: [{ provide: FloorRepository, useExisting: FloorRepositoryImpl }],
})
export class FloorsModule {}
