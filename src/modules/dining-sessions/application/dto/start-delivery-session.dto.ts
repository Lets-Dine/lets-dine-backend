import { createZodDto } from "nestjs-zod";
import { startDeliverySessionSchema } from "../../interfaces/http/validations/start-delivery-session.validation";

export class StartDeliverySessionDto extends createZodDto(startDeliverySessionSchema) {}
