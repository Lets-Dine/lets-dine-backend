import { z } from "zod";

export const paymentRegisterSchema = z.object({
  /** The Nepali fiscal year as printed on the invoices, e.g. "2083/84". Omitted, the current one. */
  fiscalYear: z
    .string()
    .regex(/^\d{4}\/\d{2}$/, "Fiscal year looks like 2083/84")
    .optional(),
});

export type PaymentRegisterQuery = z.infer<typeof paymentRegisterSchema>;
