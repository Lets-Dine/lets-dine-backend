import { createZodDto } from "nestjs-zod";
import { generateInvoicesSchema } from "../../interfaces/http/validations/generate-invoices.validation";

export class GenerateInvoicesDto extends createZodDto(generateInvoicesSchema) {}
