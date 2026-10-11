import { DeliveryAccountKind, DeliverySettlementDirection, DeliverySettlementMethod } from "@prisma/client";
import { z } from "zod";

export const recordSettlementSchema = z.object({
  accountKind: z.nativeEnum(DeliveryAccountKind),
  accountId: z.string().uuid(),
  direction: z.nativeEnum(DeliverySettlementDirection),
  /** Money that actually changes hands. */
  amount: z.number().int().min(1).max(1_000_000_000),
  /** Cleared on the other side in the same act — fees netted off a collection, or cash netted off a payout. */
  offset: z.number().int().min(0).max(1_000_000_000).default(0),
  method: z.nativeEnum(DeliverySettlementMethod).default(DeliverySettlementMethod.CASH),
  note: z.string().trim().max(120).default(""),
});

export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
