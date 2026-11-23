import { createZodDto } from "nestjs-zod";
import { createCustomerSchema } from "../../interfaces/http/validations/create-customer.validation";

export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
