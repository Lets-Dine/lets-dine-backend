import { createZodDto } from "nestjs-zod";
import {
  adjustSubscriptionSchema,
  cancelSubscriptionSchema,
  reactivateSubscriptionSchema,
} from "../../interfaces/http/validations/subscription-edit.validation";

export class AdjustSubscriptionDto extends createZodDto(adjustSubscriptionSchema) {}
export class CancelSubscriptionDto extends createZodDto(cancelSubscriptionSchema) {}
export class ReactivateSubscriptionDto extends createZodDto(reactivateSubscriptionSchema) {}
