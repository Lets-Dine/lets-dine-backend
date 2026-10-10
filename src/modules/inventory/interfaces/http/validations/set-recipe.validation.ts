import { z } from "zod";

export const setRecipeSchema = z.object({
  lines: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        variantId: z.string().uuid().nullable().default(null),
        addOnId: z.string().uuid().nullable().default(null),
        quantity: z.number().int().min(1),
      })
    )
    .max(60)
    .refine(lines => lines.every(line => !(line.variantId && line.addOnId)), { message: "A line is for a variant or an add-on, not both" }),
});

export type SetRecipeInput = z.infer<typeof setRecipeSchema>;
