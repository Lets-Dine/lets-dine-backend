import { z } from "zod";

const limit = z.number().int().nonnegative();

/** A missing key means unlimited. */
export const planLimitsSchema = z.object({
  branches: limit.optional(),
  staffSeats: limit.optional(),
  ordersPerMonth: limit.optional(),
});

export const planFeaturesSchema = z.object({
  analyticsTier: z.enum(["basic", "full"]).default("basic"),
  exports: z.boolean().default(false),
  /**
   * Whether starting a dish can take its recipe off stock by itself. Off means stock is only moved by
   * hand, whatever the restaurant, branch or dish says. Missing means on, so a plan that predates the
   * feature keeps working as it did.
   */
  autoStockConsumption: z.boolean().default(true),
  /** A missing value means the full history is kept. */
  auditRetentionDays: z.number().int().positive().optional(),
});

export type PlanLimitsConfig = z.infer<typeof planLimitsSchema>;
export type PlanFeaturesConfig = z.infer<typeof planFeaturesSchema>;
