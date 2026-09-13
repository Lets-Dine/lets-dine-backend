import { createZodDto } from "nestjs-zod";
import { createOrderSchema } from "../../interfaces/http/validations/create-order.validation";

export class CreateOrderDto extends createZodDto(createOrderSchema) {}
