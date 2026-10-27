import { createZodDto } from "nestjs-zod";
import { createPrinterSchema } from "../../interfaces/http/validations/create-printer.validation";

export class CreatePrinterDto extends createZodDto(createPrinterSchema) {}
