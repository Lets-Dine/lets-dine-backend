import { createZodDto } from "nestjs-zod";
import { setBranchHoursSchema } from "../../interfaces/http/validations/set-branch-hours.validation";

export class SetBranchHoursDto extends createZodDto(setBranchHoursSchema) {}
