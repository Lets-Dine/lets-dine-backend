import { createZodDto } from "nestjs-zod";
import { registerRestaurantSchema } from "../../interfaces/http/validations/register-restaurant.validation";

export class RegisterRestaurantDto extends createZodDto(registerRestaurantSchema) {}
