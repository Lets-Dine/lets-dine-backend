import { BillingInterval } from "@prisma/client";
import { z } from "zod";

export const changePlanSchema = z.object({
  planKey: z.string().trim().min(1),
  /** Omit to keep the current billing interval. */
  interval: z.nativeEnum(BillingInterval).optional(),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
