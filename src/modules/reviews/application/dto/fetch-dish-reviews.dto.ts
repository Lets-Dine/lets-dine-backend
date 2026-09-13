import { createZodDto } from "nestjs-zod";
import { fetchDishReviewsSchema } from "../../interfaces/http/validations/fetch-dish-reviews.validation";

export class FetchDishReviewsDto extends createZodDto(fetchDishReviewsSchema) {}
