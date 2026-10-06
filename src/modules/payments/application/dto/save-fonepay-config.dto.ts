import { createZodDto } from "nestjs-zod";
import { saveFonepayConfigSchema } from "../../interfaces/http/validations/save-fonepay-config.validation";

export class SaveFonepayConfigDto extends createZodDto(saveFonepayConfigSchema) {}
