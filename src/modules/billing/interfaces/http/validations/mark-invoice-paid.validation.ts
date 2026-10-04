import { z } from "zod";

export const markInvoicePaidSchema = z.object({
  /** Free text ("bank", "esewa", "cash"...) — how the money arrived is not something billing needs to model yet. */
  paymentMethod: z.string().trim().min(1).max(50),
  paymentRef: z.string().trim().max(200).optional(),
});

export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>;
