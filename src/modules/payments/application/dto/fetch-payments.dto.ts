import { createZodDto } from "nestjs-zod";
import { fetchPaymentsSchema } from "../../interfaces/http/validations/fetch-payments.validation";

export class FetchPaymentsDto extends createZodDto(fetchPaymentsSchema) {}
