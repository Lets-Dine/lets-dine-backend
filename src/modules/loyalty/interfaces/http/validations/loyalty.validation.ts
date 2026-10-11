import { z } from "zod";

export const customerLoyaltyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adjustLoyaltySchema = z.object({
  /** Signed: positive gives points, negative takes them away. */
  points: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine(points => points !== 0, "Points can't be zero"),
  /** Why — it is the only record of a manual change. */
  note: z.string().trim().min(1).max(200),
});

export const updateLoyaltyProgramSchema = z
  .object({
    enabled: z.boolean(),
    spendPerPoint: z.number().int().min(1).max(10_000_000),
    redeemValue: z.number().int().min(1).max(10_000_000),
    maxRedeemPct: z.number().int().min(1).max(100),
    reviewBonus: z.number().int().min(0).max(1_000_000),
  })
  // A bill paid mostly in points still earns points, so what points can pay for must stay worth less than the
  // spending that earns them: otherwise spending points makes more than it costs and a diner can cycle them
  // forever. Earning B/spendPerPoint while spending (maxRedeemPct% of B)/redeemValue breaks even when
  // maxRedeemPct * spendPerPoint = redeemValue * 100.
  .refine(program => program.redeemValue * program.maxRedeemPct < program.spendPerPoint * 100, {
    message: "A point must be worth less than the spending that earns one, at the share of a bill points may pay for",
    path: ["redeemValue"],
  });

export type CustomerLoyaltyQuery = z.infer<typeof customerLoyaltyQuerySchema>;
export type AdjustLoyaltyInput = z.infer<typeof adjustLoyaltySchema>;
export type UpdateLoyaltyProgramInput = z.infer<typeof updateLoyaltyProgramSchema>;
