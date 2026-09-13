import { createZodDto } from "nestjs-zod";
import { fetchRestaurantsSchema } from "../../interfaces/http/validations/fetch-restaurants.validation";

export class FetchRestaurantsDto extends createZodDto(fetchRestaurantsSchema) {}
