import { createZodDto } from "nestjs-zod";
import { fetchCustomersSchema } from "../../interfaces/http/validations/fetch-customers.validation";

export class FetchCustomersDto extends createZodDto(fetchCustomersSchema) {}
