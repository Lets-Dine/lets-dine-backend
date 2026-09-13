import { createZodDto } from "nestjs-zod";
import { reorderDishesSchema } from "../../interfaces/http/validations/reorder-dishes.validation";

export class ReorderDishesDto extends createZodDto(reorderDishesSchema) {}
