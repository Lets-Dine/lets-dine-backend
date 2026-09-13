import { createZodDto } from "nestjs-zod";
import { updateRestaurantSchema } from "../../interfaces/http/validations/update-restaurant.validation";

export class UpdateRestaurantDto extends createZodDto(updateRestaurantSchema) {}
