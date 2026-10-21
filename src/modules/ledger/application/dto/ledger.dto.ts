import { createZodDto } from "nestjs-zod";
import { closeLedgerSchema } from "../../interfaces/http/validations/close-ledger.validation";
import {
  createRecurringExpenseSchema,
  settleRecurringExpenseSchema,
  updateRecurringExpenseSchema,
} from "../../interfaces/http/validations/recurring-expense.validation";
import { createExpenseSchema } from "../../interfaces/http/validations/create-expense.validation";
import { fetchLedgerEntriesSchema, fetchLedgerBookSchema } from "../../interfaces/http/validations/fetch-ledger-entries.validation";
import { fetchLedgerListSchema } from "../../interfaces/http/validations/fetch-ledger-list.validation";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}
export class CloseLedgerDto extends createZodDto(closeLedgerSchema) {}
export class FetchLedgerEntriesDto extends createZodDto(fetchLedgerEntriesSchema) {}
export class FetchLedgerListDto extends createZodDto(fetchLedgerListSchema) {}
export class FetchLedgerBookDto extends createZodDto(fetchLedgerBookSchema) {}
export class CreateRecurringExpenseDto extends createZodDto(createRecurringExpenseSchema) {}
export class UpdateRecurringExpenseDto extends createZodDto(updateRecurringExpenseSchema) {}
export class SettleRecurringExpenseDto extends createZodDto(settleRecurringExpenseSchema) {}
