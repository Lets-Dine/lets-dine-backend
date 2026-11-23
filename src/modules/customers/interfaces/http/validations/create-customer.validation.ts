import { z } from "zod";

/** A customer staff add at the till: a name and a phone, the same two things a delivery order takes. */
export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    phone: z.string().trim().min(6).max(20),
  })
  .strict();

export type CreateCustomerBody = z.infer<typeof createCustomerSchema>;
