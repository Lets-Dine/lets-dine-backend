import { createZodDto } from "nestjs-zod";
import { switchBranchSchema } from "../../interfaces/http/validations/switch-branch.validation";

export class SwitchBranchDto extends createZodDto(switchBranchSchema) {}
