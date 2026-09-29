import { createZodDto } from "nestjs-zod";
import { updateDishVariantSchema } from "../../interfaces/http/validations/update-dish-variant.validation";

export class UpdateDishVariantDto extends createZodDto(updateDishVariantSchema) {}
