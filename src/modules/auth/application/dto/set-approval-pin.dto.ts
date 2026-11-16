import { createZodDto } from "nestjs-zod";
import { setApprovalPinSchema } from "../../interfaces/http/validations/set-approval-pin.validation";

export class SetApprovalPinDto extends createZodDto(setApprovalPinSchema) {}
