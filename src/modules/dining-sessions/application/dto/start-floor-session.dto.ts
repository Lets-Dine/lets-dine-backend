import { createZodDto } from "nestjs-zod";
import { startFloorSessionSchema } from "../../interfaces/http/validations/start-floor-session.validation";

export class StartFloorSessionDto extends createZodDto(startFloorSessionSchema) {}
