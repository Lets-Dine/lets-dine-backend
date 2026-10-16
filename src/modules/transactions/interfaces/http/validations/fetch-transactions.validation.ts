import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

export const fetchTransactionsSchema = z.object({
  type: z.enum(["SALE", "PURCHASE", "EXPENSE", "INCOME", "TRANSFER", "REFUND", "DELIVERY_FEE"]).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  category: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  customerId: z.string().uuid().optional(),
  supplier: z.string().trim().max(120).optional(),
  /** Only what is still owed (a receivable or a payable). */
  outstandingOnly: z
    .enum(["true", "false"])
    .transform(v => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type FetchTransactionsQuery = z.infer<typeof fetchTransactionsSchema>;
