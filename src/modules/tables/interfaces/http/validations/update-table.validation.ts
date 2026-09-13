import { z } from "zod";

export const updateTableSchema = z
  .object({
    name: z.string().min(1).max(40).optional(),
    capacity: z.number().int().min(1).max(40).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateTableInput = z.infer<typeof updateTableSchema>;
