import { z } from "zod";

export const fetchOrderComparisonSchema = z.object({
  period: z.enum(["today", "week", "month"]),
  /** Narrow to one branch. Owners default to every branch; others to the branches they are assigned to. */
  branchId: z.string().uuid().optional(),
});

export type FetchOrderComparisonQuery = z.infer<typeof fetchOrderComparisonSchema>;
