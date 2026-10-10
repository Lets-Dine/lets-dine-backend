import { z } from "zod";

export const updateIngredientSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  unit: z.string().trim().min(1).max(10).optional(),
  parLevel: z.number().int().min(0).optional(),
  isArchived: z.boolean().optional(),
});

export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
