import { createZodDto } from "nestjs-zod";
import { fetchMenuCategoriesSchema } from "../../interfaces/http/validations/fetch-menu-categories.validation";

export class FetchMenuCategoriesDto extends createZodDto(fetchMenuCategoriesSchema) {}
