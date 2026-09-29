import { createZodDto } from "nestjs-zod";
import { updateAddOnSchema } from "../../interfaces/http/validations/update-add-on.validation";

export class UpdateAddOnDto extends createZodDto(updateAddOnSchema) {}
