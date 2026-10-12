import { z } from "zod";

/** No `name`: deliveries refer to a supplier by name, so it stays as first saved. */
export const updateSupplierSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  note: z.string().trim().max(300).optional(),
  isArchived: z.boolean().optional(),
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
