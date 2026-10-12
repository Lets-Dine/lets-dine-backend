import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const returnStockSchema = z.object({
  lotId: z.string().uuid(),
  /** Base units going back; at most what is left of that delivery. */
  quantity: z.number().int().min(1),
  /** Minor units the supplier gives back. Left out, it is the share of the delivery's price. */
  refund: z.number().int().min(0).optional(),
  /** How a money-back refund arrived (credit deliveries take it off what is owed instead). */
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  note: z.string().trim().max(200).default(""),
});

export type ReturnStockInput = z.infer<typeof returnStockSchema>;
