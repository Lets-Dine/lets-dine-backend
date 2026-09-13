import { z } from "zod";

export const reorderMenuCategoriesSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
    .min(1)
    .max(200),
});

export type ReorderMenuCategoriesInput = z.infer<typeof reorderMenuCategoriesSchema>;
