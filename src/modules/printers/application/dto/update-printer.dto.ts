import { createZodDto } from "nestjs-zod";
import { updatePrinterSchema } from "../../interfaces/http/validations/update-printer.validation";

export class UpdatePrinterDto extends createZodDto(updatePrinterSchema) {}
