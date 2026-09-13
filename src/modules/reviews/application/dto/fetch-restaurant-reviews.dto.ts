import { createZodDto } from "nestjs-zod";
import { fetchRestaurantReviewsSchema } from "../../interfaces/http/validations/fetch-restaurant-reviews.validation";

export class FetchRestaurantReviewsDto extends createZodDto(fetchRestaurantReviewsSchema) {}
