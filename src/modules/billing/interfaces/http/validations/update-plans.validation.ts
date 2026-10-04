import { z } from "zod";
import { planFeaturesSchema, planLimitsSchema } from "./plan-config.validation";

const price = z.number().int().nonnegative();

/** One plan as the platform Plans page edits it, identified by its key. Type, visibility and currency are not editable here. */
export const updatePlanItemSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1).max(24),
  monthlyPrice: price,
  annualPrice: price,
  /** Null means the extra is not offered on this plan. */
  extraBranchPrice: price.nullable(),
  extraSeatPrice: price.nullable(),
  limits: planLimitsSchema,
  features: planFeaturesSchema,
});

export const updatePlansSchema = z.object({
  plans: z
    .array(updatePlanItemSchema)
    .min(1)
    .refine(plans => new Set(plans.map(plan => plan.key)).size === plans.length, { message: "Plan keys must be unique" }),
});

export type UpdatePlanItemInput = z.infer<typeof updatePlanItemSchema>;
export type UpdatePlansInput = z.infer<typeof updatePlansSchema>;
