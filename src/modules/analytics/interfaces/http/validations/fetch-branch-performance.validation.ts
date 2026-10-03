import { z } from "zod";

export const fetchBranchPerformanceSchema = z.object({
  /** Defaults to the trailing 30 days when either end is left off. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type FetchBranchPerformanceQuery = z.infer<typeof fetchBranchPerformanceSchema>;
