import { createZodDto } from "nestjs-zod";
import { advanceOrderItemStatusSchema } from "../../interfaces/http/validations/advance-order-item-status.validation";

export class AdvanceOrderItemStatusDto extends createZodDto(advanceOrderItemStatusSchema) {}
