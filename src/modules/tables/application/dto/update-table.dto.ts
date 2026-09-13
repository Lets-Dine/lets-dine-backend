import { createZodDto } from "nestjs-zod";
import { updateTableSchema } from "../../interfaces/http/validations/update-table.validation";

export class UpdateTableDto extends createZodDto(updateTableSchema) {}
