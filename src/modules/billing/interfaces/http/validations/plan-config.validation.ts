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
  /** A missing value means the full history is kept. */
  auditRetentionDays: z.number().int().positive().optional(),
});

export type PlanLimitsConfig = z.infer<typeof planLimitsSchema>;
export type PlanFeaturesConfig = z.infer<typeof planFeaturesSchema>;
