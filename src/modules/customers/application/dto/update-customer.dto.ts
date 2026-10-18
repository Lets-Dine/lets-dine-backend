import { createZodDto } from "nestjs-zod";
import { updateCustomerSchema } from "../../interfaces/http/validations/update-customer.validation";

export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
