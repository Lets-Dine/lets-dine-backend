import { createZodDto } from "nestjs-zod";
import { fetchFloorsSchema } from "../../interfaces/http/validations/fetch-floors.validation";

export class FetchFloorsDto extends createZodDto(fetchFloorsSchema) {}
