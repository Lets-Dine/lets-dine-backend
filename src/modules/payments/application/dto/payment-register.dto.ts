import { createZodDto } from "nestjs-zod";
import { paymentRegisterSchema } from "../../interfaces/http/validations/payment-register.validation";

export class PaymentRegisterDto extends createZodDto(paymentRegisterSchema) {}
