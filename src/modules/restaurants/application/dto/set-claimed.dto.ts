import { createZodDto } from "nestjs-zod";
import { setClaimedSchema } from "../../interfaces/http/validations/register-restaurant.validation";

export class SetClaimedDto extends createZodDto(setClaimedSchema) {}
