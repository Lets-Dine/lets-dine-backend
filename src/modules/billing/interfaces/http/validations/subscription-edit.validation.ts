import { z } from "zod";
import { featureOverridesPatchSchema } from "./plan-config.validation";

const reason = z.string().trim().min(3).max(140);

export const adjustSubscriptionSchema = z.object({
  reason,
  discountPercent: z.number().int().min(0).max(100).nullable().optional(),
  discountEndsAt: z.coerce
    .date()
    .refine(date => date > new Date(), "Must be in the future")
    .nullable()
    .optional(),
  /** Only while on trial; moves the end of the paid window with it. */
  trialEndsAt: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  /** A null key clears that override. */
  featureOverrides: featureOverridesPatchSchema.optional(),
});

export const cancelSubscriptionSchema = z.object({ reason, when: z.enum(["NOW", "PERIOD_END"]) });
export const reactivateSubscriptionSchema = z.object({ reason });

export type AdjustSubscriptionInput = z.infer<typeof adjustSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type ReactivateSubscriptionInput = z.infer<typeof reactivateSubscriptionSchema>;
