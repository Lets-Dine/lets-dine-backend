import { z } from "zod";

export const updateAddOnSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    price: z.number().int().min(0).optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateAddOnInput = z.infer<typeof updateAddOnSchema>;
