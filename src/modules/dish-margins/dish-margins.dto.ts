import { createZodDto } from "nestjs-zod";
import { fetchMarginsSchema } from "./interfaces/http/validations/fetch-margins.validation";

export class FetchMarginsDto extends createZodDto(fetchMarginsSchema) {}
