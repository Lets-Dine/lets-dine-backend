import { createZodDto } from "nestjs-zod";
import { fetchRevenueTrendSchema } from "../../interfaces/http/validations/fetch-revenue-trend.validation";

export class FetchRevenueTrendDto extends createZodDto(fetchRevenueTrendSchema) {}
