import { createZodDto } from "nestjs-zod";
import { collectPaymentSchema, refundPaymentSchema } from "../../interfaces/http/validations/collect-payment.validation";

export class CollectPaymentDto extends createZodDto(collectPaymentSchema) {}
export class RefundPaymentDto extends createZodDto(refundPaymentSchema) {}
