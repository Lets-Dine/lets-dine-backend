import { createZodDto } from "nestjs-zod";
import { fetchPaymentsSummarySchema } from "../../interfaces/http/validations/fetch-payments.validation";

export class FetchPaymentsSummaryDto extends createZodDto(fetchPaymentsSummarySchema) {}
