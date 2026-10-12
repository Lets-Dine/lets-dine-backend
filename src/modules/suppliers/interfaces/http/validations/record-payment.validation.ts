import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const recordPaymentSchema = z.object({
  supplier: z.string().trim().min(1).max(80),
  /** Minor units. */
  amount: z.number().int().min(1),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  note: z.string().trim().max(200).default(""),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
