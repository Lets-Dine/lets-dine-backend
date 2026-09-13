// application/dto/{action}-{feature-name}.dto.ts
import { createZodDto } from "nestjs-zod";
import { {action}{Feature}Schema } from "../../interfaces/http/validations/{action}-{feature-name}.validation";

export class {Action}{Feature}Dto extends createZodDto({action}{Feature}Schema) {}
