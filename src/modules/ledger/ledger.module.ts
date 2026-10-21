import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { CreateRecurringExpenseUsecase } from "./application/use-cases/create-recurring-expense.usecase";
import { DeleteRecurringExpenseUsecase } from "./application/use-cases/delete-recurring-expense.usecase";
import { ListRecurringExpensesUsecase } from "./application/use-cases/list-recurring-expenses.usecase";
import { SettleRecurringExpenseUsecase } from "./application/use-cases/settle-recurring-expense.usecase";
import { UpdateRecurringExpenseUsecase } from "./application/use-cases/update-recurring-expense.usecase";
import { RecurringExpenseRepository } from "./domain/repositories/recurring-expense.repository";
import RecurringExpenseRepositoryImpl from "./infrastructure/repositories/recurring-expense.repository.impl";
import { RecurringExpenseController } from "./interfaces/http/recurring-expense.controller";
import { ReopenLedgerUsecase } from "./application/use-cases/reopen-ledger.usecase";
import { CloseLedgerUsecase } from "./application/use-cases/close-ledger.usecase";
import { CreateExpenseUsecase } from "./application/use-cases/create-expense.usecase";
import { DeleteExpenseUsecase } from "./application/use-cases/delete-expense.usecase";
import { GetCashBookUsecase } from "./application/use-cases/get-cash-book.usecase";
import { GetLedgerEntriesUsecase } from "./application/use-cases/get-ledger-entries.usecase";
import { GetLedgerSummaryUsecase } from "./application/use-cases/get-ledger-summary.usecase";
import { ListClosesUsecase } from "./application/use-cases/list-closes.usecase";
import { ListExpensesUsecase } from "./application/use-cases/list-expenses.usecase";
import { LedgerRepository } from "./domain/repositories/ledger.repository";
import LedgerRepositoryImpl from "./infrastructure/repositories/ledger.repository.impl";
import { LedgerController } from "./interfaces/http/ledger.controller";

@Module({
  imports: [AuditLogsModule, RestaurantsModule],
  controllers: [LedgerController, RecurringExpenseController],
  providers: [
    GetLedgerSummaryUsecase,
    GetLedgerEntriesUsecase,
    GetCashBookUsecase,
    CloseLedgerUsecase,
    ReopenLedgerUsecase,
    ListClosesUsecase,
    CreateExpenseUsecase,
    ListExpensesUsecase,
    DeleteExpenseUsecase,
    ListRecurringExpensesUsecase,
    CreateRecurringExpenseUsecase,
    UpdateRecurringExpenseUsecase,
    DeleteRecurringExpenseUsecase,
    SettleRecurringExpenseUsecase,
    RecurringExpenseRepositoryImpl,
    { provide: RecurringExpenseRepository, useExisting: RecurringExpenseRepositoryImpl },
    LedgerRepositoryImpl,
    { provide: LedgerRepository, useExisting: LedgerRepositoryImpl },
  ],
  // Delivery settlements post their rows through the same repository, in their own transaction.
  exports: [LedgerRepository],
})
export class LedgerModule {}
