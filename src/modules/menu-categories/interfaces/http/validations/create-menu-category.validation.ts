import { z } from "zod";

export const createMenuCategorySchema = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
