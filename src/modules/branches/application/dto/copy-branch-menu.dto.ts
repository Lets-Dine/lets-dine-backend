import { createZodDto } from "nestjs-zod";
import { copyBranchMenuSchema } from "../../interfaces/http/validations/copy-branch-menu.validation";

export class CopyBranchMenuDto extends createZodDto(copyBranchMenuSchema) {}
