import { createZodDto } from "nestjs-zod";
import { fetchReceivablesSchema } from "./interfaces/http/validations/fetch-receivables.validation";

export class FetchReceivablesDto extends createZodDto(fetchReceivablesSchema) {}
