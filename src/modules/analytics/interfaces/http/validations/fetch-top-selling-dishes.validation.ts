import { z } from "zod";

/**
 * Neither given → everything to date. Only `startDate` → that one day.
 * Both → that inclusive range. `endDate` without `startDate` is rejected by
 * the usecase rather than silently guessed at.
 */
export const fetchTopSellingDishesSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  /** Narrow to one branch. Owners default to every branch; others to the branches they are assigned to. */
  branchId: z.string().uuid().optional(),
});

export type FetchTopSellingDishesQuery = z.infer<typeof fetchTopSellingDishesSchema>;
