import { createZodDto } from "nestjs-zod";
import { fetchBranchesSchema } from "../../interfaces/http/validations/fetch-branches.validation";

export class FetchBranchesDto extends createZodDto(fetchBranchesSchema) {}
