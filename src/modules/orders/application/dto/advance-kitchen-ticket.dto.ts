import { createZodDto } from "nestjs-zod";
import { advanceKitchenTicketSchema } from "../../interfaces/http/validations/advance-kitchen-ticket.validation";

export class AdvanceKitchenTicketDto extends createZodDto(advanceKitchenTicketSchema) {}
