import { createZodDto } from "nestjs-zod";
import { confirmEsewaSchema } from "../../interfaces/http/validations/confirm-esewa.validation";

export class ConfirmEsewaDto extends createZodDto(confirmEsewaSchema) {}
