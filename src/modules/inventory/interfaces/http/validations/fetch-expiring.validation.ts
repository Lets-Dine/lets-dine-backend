import { z } from "zod";

export const fetchExpiringSchema = z.object({
  /** How many days ahead to look. 0 = only what has already expired or expires today. */
  days: z.coerce.number().int().min(0).max(30).default(3),
});

export type FetchExpiringInput = z.infer<typeof fetchExpiringSchema>;
