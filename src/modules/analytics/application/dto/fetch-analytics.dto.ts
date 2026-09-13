import { createZodDto } from "nestjs-zod";
import { fetchAnalyticsSchema } from "../../interfaces/http/validations/fetch-analytics.validation";

export class FetchAnalyticsDto extends createZodDto(fetchAnalyticsSchema) {}
