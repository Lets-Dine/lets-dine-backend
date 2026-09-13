import { createZodDto } from "nestjs-zod";
import { startDiningSessionSchema } from "../../interfaces/http/validations/start-dining-session.validation";

export class StartDiningSessionDto extends createZodDto(startDiningSessionSchema) {}
