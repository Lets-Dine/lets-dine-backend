import { OrderItemStatus } from "@prisma/client";
import { z } from "zod";

/** Staff only ever move a line forward manually — PENDING/CANCELLED are never a staff-chosen target. */
export const advanceOrderItemStatusSchema = z.object({
  status: z
    .nativeEnum(OrderItemStatus)
    .refine(status => status === OrderItemStatus.PREPARING || status === OrderItemStatus.READY || status === OrderItemStatus.SERVED, {
      message: "An item can only be advanced to PREPARING, READY or SERVED",
    }),
});

export type AdvanceOrderItemStatusInput = z.infer<typeof advanceOrderItemStatusSchema>;
