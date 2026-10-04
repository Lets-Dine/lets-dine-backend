import { createZodDto } from "nestjs-zod";
import { assignPlanSchema } from "../../interfaces/http/validations/assign-plan.validation";

export class AssignPlanDto extends createZodDto(assignPlanSchema) {}
