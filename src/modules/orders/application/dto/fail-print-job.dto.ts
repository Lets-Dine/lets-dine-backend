import { createZodDto } from "nestjs-zod";
import { failPrintJobSchema } from "../../interfaces/http/validations/fail-print-job.validation";

export class FailPrintJobDto extends createZodDto(failPrintJobSchema) {}
