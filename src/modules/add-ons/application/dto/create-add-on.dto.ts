import { createZodDto } from "nestjs-zod";
import { createAddOnSchema } from "../../interfaces/http/validations/create-add-on.validation";

export class CreateAddOnDto extends createZodDto(createAddOnSchema) {}
