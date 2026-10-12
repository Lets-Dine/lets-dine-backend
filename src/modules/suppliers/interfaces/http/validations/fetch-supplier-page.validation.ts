import { z } from "zod";

export const fetchSupplierPageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FetchSupplierPageInput = z.infer<typeof fetchSupplierPageSchema>;
