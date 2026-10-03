import { createZodDto } from "nestjs-zod";
import { createBranchSchema } from "../../interfaces/http/validations/create-branch.validation";

export class CreateBranchDto extends createZodDto(createBranchSchema) {}
