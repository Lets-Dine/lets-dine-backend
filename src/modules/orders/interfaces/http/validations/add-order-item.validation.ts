import { z } from "zod";

export const addOrderItemSchema = z.object({
  dishId: z.string().uuid(),
  addOnIds: z.array(z.string().uuid()).max(20).optional().default([]),
  variantId: z.string().uuid().optional(),
});

export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
