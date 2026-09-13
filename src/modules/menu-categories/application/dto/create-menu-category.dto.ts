import { createZodDto } from "nestjs-zod";
import { createMenuCategorySchema } from "../../interfaces/http/validations/create-menu-category.validation";

export class CreateMenuCategoryDto extends createZodDto(createMenuCategorySchema) {}
