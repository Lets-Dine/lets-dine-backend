import { DeliveryRiderKind, DeliveryRiderPayModel } from "@prisma/client";
import { z } from "zod";

export const createRiderSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30).default(""),
  kind: z.nativeEnum(DeliveryRiderKind).default(DeliveryRiderKind.STAFF),
  partnerId: z.string().uuid().nullable().default(null),
  vehicle: z.string().trim().max(60).default(""),
  note: z.string().trim().max(200).default(""),
  payModel: z.nativeEnum(DeliveryRiderPayModel).default(DeliveryRiderPayModel.SALARIED),
  /** Minor units per delivery. */
  payValue: z.number().int().min(0).max(100_000_000).default(0),
});

export type CreateRiderInput = z.infer<typeof createRiderSchema>;
