import { createZodDto } from "nestjs-zod";
import { fetchTopSellingDishesSchema } from "../../interfaces/http/validations/fetch-top-selling-dishes.validation";

export class FetchTopSellingDishesDto extends createZodDto(fetchTopSellingDishesSchema) {}
