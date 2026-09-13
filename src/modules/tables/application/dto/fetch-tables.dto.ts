import { createZodDto } from "nestjs-zod";
import { fetchTablesSchema } from "../../interfaces/http/validations/fetch-tables.validation";

export class FetchTablesDto extends createZodDto(fetchTablesSchema) {}
