import { z } from "zod";

export const createTableSchema = z.object({
  name: z.string().min(1).max(40),
  capacity: z.number().int().min(1).max(40).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
