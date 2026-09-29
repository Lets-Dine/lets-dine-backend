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
        addOnIds: z.array(z.string().uuid()).max(20).optional().default([]),
        variantId: z.string().uuid().optional(),
      })
    )
    .min(1)
    .max(60),
  /**
   * Delivery only — ignored for a dine-in session. Overrides the `Customer`
   * row's own default for this one order (e.g. deliver to the office instead
   * of home); phone/name always come from the session's own customer, never
   * the client.
   */
  deliveryAddress: z.string().min(1).max(500).optional(),
  deliveryNote: z.string().max(280).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
