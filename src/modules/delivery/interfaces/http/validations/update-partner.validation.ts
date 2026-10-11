import { DeliveryFeeModel } from "@prisma/client";
import { z } from "zod";

/** Defaults are dropped on purpose: a PATCH only touches what it names. */
export const updatePartnerSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(30).optional(),
  contactPerson: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
  feeModel: z.nativeEnum(DeliveryFeeModel).optional(),
  feeValue: z.number().int().min(0).max(100_000_000).optional(),
  collectsCash: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
