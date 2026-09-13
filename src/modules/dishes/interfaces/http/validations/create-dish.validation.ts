import { z } from "zod";

export const createDishSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(500).nullish(),
  /** Integer minor units — a price is never sent as 4.20. */
  price: z.number().int().min(0),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  spiceLevel: z.number().int().min(0).max(3).optional(),
  isVeg: z.boolean().optional(),
});

export type CreateDishInput = z.infer<typeof createDishSchema>;
