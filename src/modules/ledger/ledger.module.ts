import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ReopenLedgerUsecase } from "./application/use-cases/reopen-ledger.usecase";
import { CloseLedgerUsecase } from "./application/use-cases/close-ledger.usecase";
import { CreateExpenseUsecase } from "./application/use-cases/create-expense.usecase";
import { DeleteExpenseUsecase } from "./application/use-cases/delete-expense.usecase";
import { GetLedgerEntriesUsecase } from "./application/use-cases/get-ledger-entries.usecase";
import { GetLedgerSummaryUsecase } from "./application/use-cases/get-ledger-summary.usecase";
import { ListClosesUsecase } from "./application/use-cases/list-closes.usecase";
import { ListExpensesUsecase } from "./application/use-cases/list-expenses.usecase";
import { LedgerRepository } from "./domain/repositories/ledger.repository";
import LedgerRepositoryImpl from "./infrastructure/repositories/ledger.repository.impl";
import { LedgerController } from "./interfaces/http/ledger.controller";

@Module({
  imports: [AuditLogsModule],
  controllers: [LedgerController],
  providers: [
    GetLedgerSummaryUsecase,
    GetLedgerEntriesUsecase,
    CloseLedgerUsecase,
    ReopenLedgerUsecase,
    ListClosesUsecase,
    CreateExpenseUsecase,
    ListExpensesUsecase,
    DeleteExpenseUsecase,
    LedgerRepositoryImpl,
    { provide: LedgerRepository, useExisting: LedgerRepositoryImpl },
  ],
})
export class LedgerModule {}
