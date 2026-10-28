import { createZodDto } from "nestjs-zod";
import { signQzRequestSchema } from "../../interfaces/http/validations/sign-qz-request.validation";

export class SignQzRequestDto extends createZodDto(signQzRequestSchema) {}
