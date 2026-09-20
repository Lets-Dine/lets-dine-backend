import { createZodDto } from "nestjs-zod";
import { completePaymentSchema } from "../../interfaces/http/validations/complete-payment.validation";

export class CompletePaymentDto extends createZodDto(completePaymentSchema) {}
