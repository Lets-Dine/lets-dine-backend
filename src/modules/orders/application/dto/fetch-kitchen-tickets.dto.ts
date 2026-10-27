import { createZodDto } from "nestjs-zod";
import { fetchKitchenTicketsSchema } from "../../interfaces/http/validations/fetch-kitchen-tickets.validation";

export class FetchKitchenTicketsDto extends createZodDto(fetchKitchenTicketsSchema) {}
