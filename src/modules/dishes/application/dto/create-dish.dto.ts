import { createZodDto } from "nestjs-zod";
import { createDishSchema } from "../../interfaces/http/validations/create-dish.validation";

export class CreateDishDto extends createZodDto(createDishSchema) {}
