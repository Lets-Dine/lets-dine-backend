import { DeliverySettlementMethod } from "@prisma/client";
import { z } from "zod";

export const settleDeliveryOrderSchema = z.object({
  /** Pay the courier's fee as part of settling. False leaves it owed, to be paid later from the courier's page. */
  payFee: z.boolean().default(true),
  /** How the fee is paid, when it is. */
  feeMethod: z.nativeEnum(DeliverySettlementMethod).default(DeliverySettlementMethod.CASH),
});

export type SettleDeliveryOrderInput = z.infer<typeof settleDeliveryOrderSchema>;
