import { createZodDto } from "nestjs-zod";
import { createFloorSchema } from "../../interfaces/http/validations/create-floor.validation";

export class CreateFloorDto extends createZodDto(createFloorSchema) {}
