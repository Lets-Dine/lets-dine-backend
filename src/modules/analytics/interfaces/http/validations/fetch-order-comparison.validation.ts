import { z } from "zod";

export const fetchOrderComparisonSchema = z.object({
  period: z.enum(["today", "week", "month"]),
});

export type FetchOrderComparisonQuery = z.infer<typeof fetchOrderComparisonSchema>;
