import { createZodDto } from "nestjs-zod";
import { fetchPlatformInvoicesSchema } from "../../interfaces/http/validations/fetch-platform-invoices.validation";

export class FetchPlatformInvoicesDto extends createZodDto(fetchPlatformInvoicesSchema) {}
