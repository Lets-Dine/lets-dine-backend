import { createZodDto } from "nestjs-zod";
import { updateMenuCategorySchema } from "../../interfaces/http/validations/update-menu-category.validation";

export class UpdateMenuCategoryDto extends createZodDto(updateMenuCategorySchema) {}
