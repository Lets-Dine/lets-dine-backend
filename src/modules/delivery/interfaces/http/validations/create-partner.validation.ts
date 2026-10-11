import { DeliveryFeeModel } from "@prisma/client";
import { z } from "zod";

export const createPartnerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30).default(""),
  contactPerson: z.string().trim().max(60).default(""),
  note: z.string().trim().max(200).default(""),
  feeModel: z.nativeEnum(DeliveryFeeModel).default(DeliveryFeeModel.FLAT),
  /** Minor units for FLAT; basis points for PERCENT. */
  feeValue: z.number().int().min(0).max(100_000_000).default(0),
  collectsCash: z.boolean().default(true),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
