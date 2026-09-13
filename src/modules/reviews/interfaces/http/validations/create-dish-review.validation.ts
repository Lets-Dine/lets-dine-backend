import { z } from "zod";

const star = z.number().int().min(1).max(5);

/** §9 — one overall star plus the three sub-scores, and an optional sentence. */
export const createDishReviewSchema = z.object({
  orderId: z.string().uuid(),
  dishId: z.string().uuid(),
  overall: star,
  taste: star,
  portion: star,
  value: star,
  wouldOrderAgain: z.boolean(),
  comment: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(6).optional(),
});

export type CreateDishReviewInput = z.infer<typeof createDishReviewSchema>;
