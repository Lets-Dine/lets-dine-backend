import { z } from "zod";

export const fetchBuyListSchema = z.object({
  /** How many days ahead to cover, starting tomorrow. */
  days: z.coerce.number().int().min(1).max(7).default(1),
});

export type FetchBuyListInput = z.infer<typeof fetchBuyListSchema>;
