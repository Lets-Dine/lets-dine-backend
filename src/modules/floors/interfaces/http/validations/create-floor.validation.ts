import { z } from "zod";

export const createFloorSchema = z.object({
  name: z.string().min(1).max(40),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateFloorInput = z.infer<typeof createFloorSchema>;
