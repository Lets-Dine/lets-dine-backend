import { createZodDto } from "nestjs-zod";
import { updateBranchSchema } from "../../interfaces/http/validations/update-branch.validation";

export class UpdateBranchDto extends createZodDto(updateBranchSchema) {}
