import { z } from "zod";

export const fetchAnalyticsSchema = z.object({
  /** Defaults to the trailing 30 days when either end is left off. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Narrow to one branch. Owners default to every branch; others to the branches they are assigned to. */
  branchId: z.string().uuid().optional(),
  dishLimit: z.coerce.number().int().min(1).max(100).optional(),
});

export type FetchAnalyticsQuery = z.infer<typeof fetchAnalyticsSchema>;
