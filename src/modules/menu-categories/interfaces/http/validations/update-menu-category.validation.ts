import { z } from "zod";

export const updateMenuCategorySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    emoji: z.string().max(8).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
