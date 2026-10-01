import { createZodDto } from "nestjs-zod";
import { updateFloorSchema } from "../../interfaces/http/validations/update-floor.validation";

export class UpdateFloorDto extends createZodDto(updateFloorSchema) {}
