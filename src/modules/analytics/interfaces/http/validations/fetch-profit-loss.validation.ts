import { z } from "zod";

export const fetchProfitLossSchema = z.object({
  /** `from` inclusive, `to` exclusive. */
  from: z.coerce.date(),
  to: z.coerce.date(),
  /** One branch per statement. */
  branchId: z.string().uuid(),
}).refine(q => q.to.getTime() - q.from.getTime() <= 366 * 86_400_000, { message: "The range can span at most a year", path: ["to"] });

export type FetchProfitLossQuery = z.infer<typeof fetchProfitLossSchema>;
