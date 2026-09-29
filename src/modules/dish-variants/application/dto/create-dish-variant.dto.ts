import { createZodDto } from "nestjs-zod";
import { createDishVariantSchema } from "../../interfaces/http/validations/create-dish-variant.validation";

export class CreateDishVariantDto extends createZodDto(createDishVariantSchema) {}
