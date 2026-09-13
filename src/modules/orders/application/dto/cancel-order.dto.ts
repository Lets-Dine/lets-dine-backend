import { createZodDto } from "nestjs-zod";
import { cancelOrderSchema } from "../../interfaces/http/validations/cancel-order.validation";

export class CancelOrderDto extends createZodDto(cancelOrderSchema) {}
