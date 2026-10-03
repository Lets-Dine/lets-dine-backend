import { createZodDto } from "nestjs-zod";
import { fetchMenuSchema } from "../../interfaces/http/validations/fetch-menu.validation";

export class FetchMenuDto extends createZodDto(fetchMenuSchema) {}
