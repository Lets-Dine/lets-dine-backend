import { z } from "zod";

export const fetchRevenueTrendSchema = z.object({
  period: z.enum(["week", "month", "year"]),
  /** Narrow to one branch. Owners default to every branch; others to the branches they are assigned to. */
  branchId: z.string().uuid().optional(),
});

export type FetchRevenueTrendQuery = z.infer<typeof fetchRevenueTrendSchema>;
