import { z } from "zod";

export const reorderDishesSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
    .min(1)
    .max(500),
});

export type ReorderDishesInput = z.infer<typeof reorderDishesSchema>;
