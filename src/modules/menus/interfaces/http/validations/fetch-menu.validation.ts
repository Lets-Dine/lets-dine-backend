import { z } from "zod";

export const fetchMenuSchema = z.object({
  /** Show this branch's menu — its overrides applied. Use the id from the diner's session, or a slug when browsing. */
  branchId: z.string().uuid().optional(),
  branchSlug: z.string().min(1).max(80).optional(),
});

export type FetchMenuQuery = z.infer<typeof fetchMenuSchema>;
