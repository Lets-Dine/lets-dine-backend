import { createZodDto } from "nestjs-zod";
import { claimPrintJobSchema } from "../../interfaces/http/validations/claim-print-job.validation";

export class ClaimPrintJobDto extends createZodDto(claimPrintJobSchema) {}
