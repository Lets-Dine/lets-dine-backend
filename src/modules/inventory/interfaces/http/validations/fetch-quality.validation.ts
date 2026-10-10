import { z } from "zod";

export const fetchQualitySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type FetchQualityInput = z.infer<typeof fetchQualitySchema>;
