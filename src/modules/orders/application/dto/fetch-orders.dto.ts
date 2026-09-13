import { createZodDto } from "nestjs-zod";
import { fetchOrdersSchema } from "../../interfaces/http/validations/fetch-orders.validation";

export class FetchOrdersDto extends createZodDto(fetchOrdersSchema) {}
