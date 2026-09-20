import { createZodDto } from "nestjs-zod";
import { addOrderItemSchema } from "../../interfaces/http/validations/add-order-item.validation";

export class AddOrderItemDto extends createZodDto(addOrderItemSchema) {}
