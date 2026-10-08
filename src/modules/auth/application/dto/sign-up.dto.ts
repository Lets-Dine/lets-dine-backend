import { createZodDto } from "nestjs-zod";
import { signUpRestaurantSchema } from "../../../restaurants/interfaces/http/validations/register-restaurant.validation";

export class SignUpDto extends createZodDto(signUpRestaurantSchema) {}
