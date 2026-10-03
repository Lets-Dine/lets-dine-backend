import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const CUSTOMER_SORT_KEYS = ["lastVisit", "visits", "spend", "name"] as const;

export const fetchCustomersSchema = z.object({
  ...paginationSchema,
  /** Unlike the shared schema, a page is always bounded — a restaurant's customers only grow. */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Narrower than the shared free-text `sortBy` — it's mapped onto SQL columns, never interpolated. */
  sortBy: z.enum(CUSTOMER_SORT_KEYS).default("lastVisit"),
  segment: z.enum(["new", "regular", "lapsed"]).optional(),
  /** Matches a name fragment or part of a phone number. */
  q: z.string().trim().max(60).optional(),
});

export type FetchCustomersQuery = z.infer<typeof fetchCustomersSchema>;
