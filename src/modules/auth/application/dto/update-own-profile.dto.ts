import { createZodDto } from "nestjs-zod";
import { updateOwnProfileSchema } from "../../interfaces/http/validations/update-own-profile.validation";

export class UpdateOwnProfileDto extends createZodDto(updateOwnProfileSchema) {}
