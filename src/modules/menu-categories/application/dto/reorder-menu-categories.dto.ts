import { createZodDto } from "nestjs-zod";
import { reorderMenuCategoriesSchema } from "../../interfaces/http/validations/reorder-menu-categories.validation";

export class ReorderMenuCategoriesDto extends createZodDto(reorderMenuCategoriesSchema) {}
