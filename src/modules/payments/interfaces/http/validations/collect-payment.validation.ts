import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

/** Collects some or all of what a bill still owes. The amount is checked against what the server says is owed. */
export const collectPaymentSchema = z.object({
  amount: z.number().int().min(1),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(100).default(""),
  /** A retry of the same request carries the same key and gets the first collection back, not a second one. */
  idempotencyKey: z.string().trim().min(8).max(100),
});
export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;

export const refundPaymentSchema = z.object({
  amount: z.number().int().min(1),
  method: z.nativeEnum(PaymentMethod),
  /** The collection being reversed, when known. */
  tenderId: z.string().uuid().optional(),
  reason: z.string().trim().max(200).default(""),
  idempotencyKey: z.string().trim().min(8).max(100),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
