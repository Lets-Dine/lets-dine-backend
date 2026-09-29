import { createZodDto } from "nestjs-zod";
import { setDishAddOnsSchema } from "../../interfaces/http/validations/set-dish-add-ons.validation";

export class SetDishAddOnsDto extends createZodDto(setDishAddOnsSchema) {}
