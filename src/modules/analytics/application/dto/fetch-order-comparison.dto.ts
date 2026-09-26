import { createZodDto } from "nestjs-zod";
import { fetchOrderComparisonSchema } from "../../interfaces/http/validations/fetch-order-comparison.validation";

export class FetchOrderComparisonDto extends createZodDto(fetchOrderComparisonSchema) {}
