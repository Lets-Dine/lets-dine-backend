import { createZodDto } from "nestjs-zod";
import { markInvoicePaidSchema } from "../../interfaces/http/validations/mark-invoice-paid.validation";

export class MarkInvoicePaidDto extends createZodDto(markInvoicePaidSchema) {}
