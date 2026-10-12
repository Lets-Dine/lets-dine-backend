import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).default(""),
  note: z.string().trim().max(300).default(""),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
