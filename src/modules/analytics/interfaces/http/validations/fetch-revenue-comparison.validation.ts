import { z } from "zod";

export const fetchRevenueComparisonSchema = z.object({
  period: z.enum(["today", "week", "month"]),
});

export type FetchRevenueComparisonQuery = z.infer<typeof fetchRevenueComparisonSchema>;
