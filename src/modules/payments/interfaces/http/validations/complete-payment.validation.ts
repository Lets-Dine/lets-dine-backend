import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const completePaymentSchema = z
  .object({
    sessionId: z.string().uuid(),
    /**
     * Scopes this charge to one floor order's own bill (§16b) rather than the whole session's tab —
     * only that order is marked paid; `endSession` is ignored when this is set, since a floor order
     * never fast-forwards whatever else is open on the same session (see `CompletePaymentUsecase`).
     */
    orderId: z.string().uuid().optional(),
    /** What the cashier is actually charging for. Which dish, variant and add-ons — never a client-sent price: each is priced fresh on the server. */
    items: z
      .array(
        z.object({
          dishId: z.string().uuid(),
          /** The size/style that was ordered, if the dish has variants. Its own price replaces the dish's. */
          variantId: z.string().uuid().nullish(),
          /** The extras that were ordered. Each adds its own price on top. */
          addOnIds: z.array(z.string().uuid()).max(20).default([]),
          quantity: z.number().int().min(1).max(50),
        })
      )
      .min(1),
    /** How a bill paid in full is settled. Optional when `tenders` spell the collections out. */
    method: z.nativeEnum(PaymentMethod).optional(),
    /**
     * What is collected now: a split bill is several lines, a part-payment is less than the total. Amounts are
     * checked against the server-computed total, never trusted. Omit for the usual one-method, paid-in-full bill.
     */
    tenders: z
      .array(
        z.object({
          method: z.nativeEnum(PaymentMethod),
          amount: z.number().int().min(1),
          reference: z.string().trim().max(100).optional(),
        })
      )
      .max(10)
      .optional(),
    /** Leaves the unpaid part as a receivable on the customer. Needs a customer, and is the only way to collect less than the total. */
    credit: z.boolean().optional(),
    dueDate: z.coerce.date().optional(),
    /** Same key from the same restaurant returns the first result instead of billing again. */
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
    /** A flat minor-unit reduction off the computed total — `payments:discount` only, checked in the use case. */
    discount: z.number().int().min(0).optional(),
    /**
     * Loyalty points the customer spends on this bill. Points, never money: the server turns them into a
     * discount at the restaurant's own rate. Needs only the route's own permission, not `payments:discount`.
     */
    redeemPoints: z.number().int().min(1).max(1_000_000).optional(),
    /**
     * Who the bill is for, when the cashier picks or changes it. Omitted keeps whoever the orders were placed
     * under; a uuid names another of this restaurant's customers; `null` takes the bill off its customer.
     * This decides who earns and spends loyalty points, so the server checks it, never the screen.
     */
    customerId: z.string().uuid().nullable().optional(),
    /** Also ends the visit — every order still on the session gets marked completed in the same motion. */
    endSession: z.boolean().optional(),
  })
  .refine(body => body.method || body.tenders?.length || body.credit, {
    message: "Give a method, tenders, or mark the bill as credit",
    path: ["method"],
  });

export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
