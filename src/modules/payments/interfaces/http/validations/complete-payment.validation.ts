import { z } from "zod";

export const completePaymentSchema = z.object({
  sessionId: z.string().uuid(),
  /** What the cashier is actually charging for — read fresh off the dish, never a client-sent price. */
  items: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1),
  /** Also ends the visit — every order still on the session gets marked completed in the same motion. */
  endSession: z.boolean().optional(),
});

export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
