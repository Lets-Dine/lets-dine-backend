import { createZodDto } from "nestjs-zod";
import { mergeTableSessionSchema } from "../../interfaces/http/validations/merge-table-session.validation";

export class MergeTableSessionDto extends createZodDto(mergeTableSessionSchema) {}
