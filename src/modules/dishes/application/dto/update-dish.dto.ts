import { createZodDto } from "nestjs-zod";
import { updateDishSchema } from "../../interfaces/http/validations/update-dish.validation";

export class UpdateDishDto extends createZodDto(updateDishSchema) {}
