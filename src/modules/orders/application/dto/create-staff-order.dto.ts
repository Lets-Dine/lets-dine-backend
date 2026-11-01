import { createZodDto } from "nestjs-zod";
import { createStaffOrderSchema } from "../../interfaces/http/validations/create-staff-order.validation";

export class CreateStaffOrderDto extends createZodDto(createStaffOrderSchema) {}
