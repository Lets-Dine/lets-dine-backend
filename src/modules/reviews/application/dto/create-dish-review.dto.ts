import { createZodDto } from "nestjs-zod";
import { createDishReviewSchema } from "../../interfaces/http/validations/create-dish-review.validation";

export class CreateDishReviewDto extends createZodDto(createDishReviewSchema) {}
