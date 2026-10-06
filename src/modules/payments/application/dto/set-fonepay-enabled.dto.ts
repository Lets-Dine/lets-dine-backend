import { createZodDto } from "nestjs-zod";
import { setFonepayEnabledSchema } from "../../interfaces/http/validations/set-fonepay-enabled.validation";

export class SetFonepayEnabledDto extends createZodDto(setFonepayEnabledSchema) {}
