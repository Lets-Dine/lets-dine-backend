import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CreateTableUsecase } from "./application/use-cases/create-table.usecase";
import { FetchAllTablesUsecase } from "./application/use-cases/fetch-all-tables.usecase";
import { RegenerateTableQrUsecase } from "./application/use-cases/regenerate-table-qr.usecase";
import { UpdateTableUsecase } from "./application/use-cases/update-table.usecase";
import { DiningTableRepository } from "./domain/repositories/dining-table.repository";
import DiningTableRepositoryImpl from "./infrastructure/repositories/dining-table.repository.impl";
import { DiningTableController } from "./interfaces/http/dining-table.controller";

@Module({
  imports: [AuditLogsModule],
  controllers: [DiningTableController],
  providers: [
    CreateTableUsecase,
    UpdateTableUsecase,
    RegenerateTableQrUsecase,
    FetchAllTablesUsecase,
    DiningTableRepositoryImpl,
    { provide: DiningTableRepository, useExisting: DiningTableRepositoryImpl },
  ],
  exports: [{ provide: DiningTableRepository, useExisting: DiningTableRepositoryImpl }],
})
export class TablesModule {}
