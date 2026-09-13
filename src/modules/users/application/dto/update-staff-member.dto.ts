import { createZodDto } from "nestjs-zod";
import { updateStaffMemberSchema } from "../../interfaces/http/validations/update-staff-member.validation";

export class UpdateStaffMemberDto extends createZodDto(updateStaffMemberSchema) {}
