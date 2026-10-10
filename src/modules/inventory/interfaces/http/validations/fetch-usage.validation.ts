import { z } from "zod";

export const fetchUsageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type FetchUsageInput = z.infer<typeof fetchUsageSchema>;
