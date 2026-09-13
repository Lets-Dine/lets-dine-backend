import { Module } from "@nestjs/common";
import { AuditLogService } from "./application/audit-log.service";
import { FetchAllAuditLogsUsecase } from "./application/use-cases/fetch-all-audit-logs.usecase";
import { AuditLogRepository } from "./domain/repositories/audit-log.repository";
import AuditLogRepositoryImpl from "./infrastructure/repositories/audit-log.repository.impl";
import { AuditLogController } from "./interfaces/http/audit-log.controller";

@Module({
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    FetchAllAuditLogsUsecase,
    AuditLogRepositoryImpl,
    { provide: AuditLogRepository, useExisting: AuditLogRepositoryImpl },
  ],
  exports: [AuditLogService, { provide: AuditLogRepository, useExisting: AuditLogRepositoryImpl }],
})
export class AuditLogsModule {}
