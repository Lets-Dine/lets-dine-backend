import { createZodDto } from "nestjs-zod";
import { fetchAddOnsSchema } from "../../interfaces/http/validations/fetch-add-ons.validation";

export class FetchAddOnsDto extends createZodDto(fetchAddOnsSchema) {}
