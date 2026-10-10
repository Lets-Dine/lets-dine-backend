import { z } from "zod";

export const submitStockTakeSchema = z.object({
  /** Only what was counted — an ingredient left out is untouched. */
  counts: z
    .array(z.object({ ingredientId: z.string().uuid(), quantity: z.number().int().min(0) }))
    .min(1)
    .max(300)
    .refine(counts => new Set(counts.map(c => c.ingredientId)).size === counts.length, { message: "Each ingredient is counted once" }),
});

export type SubmitStockTakeInput = z.infer<typeof submitStockTakeSchema>;
