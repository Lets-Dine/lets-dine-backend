import { z } from "zod";

export const cancelOrderSchema = z.object({
  /** §27 — a cancelled ticket has to say why; the diner sees this. */
  reason: z.string().min(1).max(280),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
