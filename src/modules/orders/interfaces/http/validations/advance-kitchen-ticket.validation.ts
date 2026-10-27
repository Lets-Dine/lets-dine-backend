import { OrderItemStatus } from "@prisma/client";
import { z } from "zod";

/** A screen only ever starts or finishes cooking — handing food over is the floor's step. */
export const advanceKitchenTicketSchema = z.object({
  status: z.enum([OrderItemStatus.PREPARING, OrderItemStatus.READY]),
});

export type AdvanceKitchenTicketInput = z.infer<typeof advanceKitchenTicketSchema>;
