import { createZodDto } from "nestjs-zod";
import { fetchMenuHighlightsSchema } from "../../interfaces/http/validations/fetch-menu-highlights.validation";

export class FetchMenuHighlightsDto extends createZodDto(fetchMenuHighlightsSchema) {}
