import { createZodDto } from "nestjs-zod";
import { updatePlansSchema } from "../../interfaces/http/validations/update-plans.validation";

export class UpdatePlansDto extends createZodDto(updatePlansSchema) {}
