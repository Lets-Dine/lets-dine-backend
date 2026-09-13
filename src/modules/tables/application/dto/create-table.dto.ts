import { createZodDto } from "nestjs-zod";
import { createTableSchema } from "../../interfaces/http/validations/create-table.validation";

export class CreateTableDto extends createZodDto(createTableSchema) {}
