import { createZodDto } from "nestjs-zod";
import { changePlanSchema } from "../../interfaces/http/validations/change-plan.validation";

export class ChangePlanDto extends createZodDto(changePlanSchema) {}
