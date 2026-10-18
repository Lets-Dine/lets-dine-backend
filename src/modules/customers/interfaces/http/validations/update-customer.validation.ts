import { z } from "zod";

export const updateCustomerSchema = z
  .object({
    email: z.string().trim().email().max(180).or(z.literal("")).transform(v => v || null),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform(v => v || null),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    notes: z.string().trim().max(500),
    offersOk: z.boolean(),
  })
  .partial()
  .strict();

export type UpdateCustomerBody = z.infer<typeof updateCustomerSchema>;
