import { createZodDto } from "nestjs-zod";
import { fetchStaffMembersSchema } from "../../interfaces/http/validations/fetch-staff-members.validation";

export class FetchStaffMembersDto extends createZodDto(fetchStaffMembersSchema) {}
