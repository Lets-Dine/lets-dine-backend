import { createZodDto } from "nestjs-zod";
import { createStaffMemberSchema } from "../../interfaces/http/validations/create-staff-member.validation";

export class CreateStaffMemberDto extends createZodDto(createStaffMemberSchema) {}
