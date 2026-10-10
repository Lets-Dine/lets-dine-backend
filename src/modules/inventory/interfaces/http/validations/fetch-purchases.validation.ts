import { z } from "zod";

export const fetchPurchasesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export type FetchPurchasesInput = z.infer<typeof fetchPurchasesSchema>;
