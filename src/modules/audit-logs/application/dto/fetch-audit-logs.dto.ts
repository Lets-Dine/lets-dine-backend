import { createZodDto } from "nestjs-zod";
import { fetchAuditLogsSchema } from "../../interfaces/http/validations/fetch-audit-logs.validation";

export class FetchAuditLogsDto extends createZodDto(fetchAuditLogsSchema) {}
