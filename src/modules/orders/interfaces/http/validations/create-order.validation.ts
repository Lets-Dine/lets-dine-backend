import { z } from "zod";

/**
 * §18/§36 — the cart sends what and how many, never prices or totals. Those are
 * read server-side at checkout.
 */
export const createOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        note: z.string().max(280).optional(),
      })
    )
    .min(1)
    .max(60),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
