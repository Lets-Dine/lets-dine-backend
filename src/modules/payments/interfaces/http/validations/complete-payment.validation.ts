import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const completePaymentSchema = z.object({
  sessionId: z.string().uuid(),
  /**
   * Scopes this charge to one floor order's own bill (§16b) rather than the whole session's tab —
   * only that order is marked paid; `endSession` is ignored when this is set, since a floor order
   * never fast-forwards whatever else is open on the same session (see `CompletePaymentUsecase`).
   */
  orderId: z.string().uuid().optional(),
  /** What the cashier is actually charging for — read fresh off the dish, never a client-sent price. */
  items: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1),
  method: z.nativeEnum(PaymentMethod),
  /** A flat minor-unit reduction off the computed total — `payments:discount` only, checked in the use case. */
  discount: z.number().int().min(0).optional(),
  /** Also ends the visit — every order still on the session gets marked completed in the same motion. */
  endSession: z.boolean().optional(),
});

export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
