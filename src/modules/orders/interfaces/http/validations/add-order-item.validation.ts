import { z } from "zod";

export const addOrderItemSchema = z.object({
  dishId: z.string().uuid(),
  addOnIds: z.array(z.string().uuid()).max(20).optional().default([]),
  variantId: z.string().uuid().optional(),
  /** The regular this table was seated for; used only when this item opens the visit's first order. */
  customerId: z.string().uuid().optional(),
});

export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
