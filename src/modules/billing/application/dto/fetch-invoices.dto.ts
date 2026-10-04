import { createZodDto } from "nestjs-zod";
import { fetchInvoicesSchema } from "../../interfaces/http/validations/fetch-invoices.validation";

export class FetchInvoicesDto extends createZodDto(fetchInvoicesSchema) {}
