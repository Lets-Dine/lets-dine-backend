import { createZodDto } from "nestjs-zod";
import { claimRestaurantSchema } from "../../interfaces/http/validations/register-restaurant.validation";

export class ClaimRestaurantDto extends createZodDto(claimRestaurantSchema) {}
