import { createZodDto } from "nestjs-zod";
import { fetchRevenueComparisonSchema } from "../../interfaces/http/validations/fetch-revenue-comparison.validation";

export class FetchRevenueComparisonDto extends createZodDto(fetchRevenueComparisonSchema) {}
