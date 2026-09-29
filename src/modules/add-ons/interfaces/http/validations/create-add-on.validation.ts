import { z } from "zod";

export const createAddOnSchema = z.object({
  name: z.string().min(1).max(120),
  /** Integer minor units — a price is never sent as 4.20. */
  price: z.number().int().min(0),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateAddOnInput = z.infer<typeof createAddOnSchema>;
