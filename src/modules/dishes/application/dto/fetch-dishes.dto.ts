import { createZodDto } from "nestjs-zod";
import { fetchDishesSchema } from "../../interfaces/http/validations/fetch-dishes.validation";

export class FetchDishesDto extends createZodDto(fetchDishesSchema) {}
