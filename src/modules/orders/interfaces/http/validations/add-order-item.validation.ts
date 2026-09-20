import { z } from "zod";

export const addOrderItemSchema = z.object({
  dishId: z.string().uuid(),
});

export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
