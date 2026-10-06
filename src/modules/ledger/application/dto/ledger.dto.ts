import { createZodDto } from "nestjs-zod";
import { closeLedgerSchema } from "../../interfaces/http/validations/close-ledger.validation";
import { createExpenseSchema } from "../../interfaces/http/validations/create-expense.validation";
import { fetchLedgerListSchema } from "../../interfaces/http/validations/fetch-ledger-list.validation";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}
export class CloseLedgerDto extends createZodDto(closeLedgerSchema) {}
export class FetchLedgerListDto extends createZodDto(fetchLedgerListSchema) {}
