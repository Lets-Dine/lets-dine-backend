import { z } from "zod";

export const cancelOrderSchema = z.object({
  /** §27 — optional: staff may say why; when given, the diner sees it. */
  reason: z.string().trim().max(280).optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
