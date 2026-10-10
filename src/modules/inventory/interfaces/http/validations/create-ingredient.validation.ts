import { z } from "zod";

export const createIngredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Base unit label — quantities are whole numbers of it (g, ml, pcs). */
  unit: z.string().trim().min(1).max(10),
  quantity: z.number().int().min(0).default(0),
  parLevel: z.number().int().min(0).default(0),
  /** What the opening stock cost, minor units, for the whole amount. Not an expense: it was bought before the app. 0 = unknown. */
  cost: z.number().int().min(0).default(0),
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
