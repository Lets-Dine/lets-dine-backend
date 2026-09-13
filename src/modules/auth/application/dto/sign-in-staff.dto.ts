import { createZodDto } from "nestjs-zod";
import { signInStaffSchema } from "../../interfaces/http/validations/sign-in-staff.validation";

export class SignInStaffDto extends createZodDto(signInStaffSchema) {}
