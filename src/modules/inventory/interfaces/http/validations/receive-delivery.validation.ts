import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const receiveDeliverySchema = z
  .object({
    quantity: z.number().int().min(1),
    supplier: z.string().trim().max(80).default(""),
    /** What was paid, minor units. 0 = no expense is booked (a gift, or already booked elsewhere). */
    cost: z.number().int().min(0).default(0),
    /** When it actually arrived, for a delivery entered late. Defaults to now; never in the future. */
    receivedAt: z.string().datetime().optional(),
    /** Best-before day (YYYY-MM-DD) printed on what arrived. Optional: not everything has one. */
    expiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
    /** Bought on credit: nothing is booked now, the supplier is owed until a payment is recorded. */
    onCredit: z.boolean().default(false),
  })
  .refine(d => !d.onCredit || (d.supplier !== "" && d.cost > 0), {
    path: ["onCredit"],
    message: "A credit purchase needs a supplier and a price",
  })
  .refine(d => !d.receivedAt || new Date(d.receivedAt).getTime() <= Date.now() + 60_000, {
    path: ["receivedAt"],
    message: "A delivery cannot arrive in the future",
  });

export type ReceiveDeliveryInput = z.infer<typeof receiveDeliverySchema>;
