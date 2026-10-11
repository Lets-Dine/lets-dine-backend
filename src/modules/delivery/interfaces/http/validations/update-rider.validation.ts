import { DeliveryRiderKind, DeliveryRiderPayModel } from "@prisma/client";
import { z } from "zod";

export const updateRiderSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(30).optional(),
  kind: z.nativeEnum(DeliveryRiderKind).optional(),
  partnerId: z.string().uuid().nullable().optional(),
  vehicle: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
  payModel: z.nativeEnum(DeliveryRiderPayModel).optional(),
  payValue: z.number().int().min(0).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRiderInput = z.infer<typeof updateRiderSchema>;
