import { createZodDto } from "nestjs-zod";
import { fetchTransactionsSchema } from "../../interfaces/http/validations/fetch-transactions.validation";

export class FetchTransactionsDto extends createZodDto(fetchTransactionsSchema) {}
