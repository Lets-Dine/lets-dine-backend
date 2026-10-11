import { createZodDto } from "nestjs-zod";
import {
  adjustLoyaltySchema,
  customerLoyaltyQuerySchema,
  updateLoyaltyProgramSchema,
} from "../../interfaces/http/validations/loyalty.validation";

export class CustomerLoyaltyQueryDto extends createZodDto(customerLoyaltyQuerySchema) {}
export class AdjustLoyaltyDto extends createZodDto(adjustLoyaltySchema) {}
export class UpdateLoyaltyProgramDto extends createZodDto(updateLoyaltyProgramSchema) {}
