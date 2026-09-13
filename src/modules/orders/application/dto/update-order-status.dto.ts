import { createZodDto } from "nestjs-zod";
import { updateOrderStatusSchema } from "../../interfaces/http/validations/update-order-status.validation";

export class UpdateOrderStatusDto extends createZodDto(updateOrderStatusSchema) {}
