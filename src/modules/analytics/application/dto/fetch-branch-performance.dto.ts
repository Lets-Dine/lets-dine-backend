import { createZodDto } from "nestjs-zod";
import { fetchBranchPerformanceSchema } from "../../interfaces/http/validations/fetch-branch-performance.validation";

export class FetchBranchPerformanceDto extends createZodDto(fetchBranchPerformanceSchema) {}
