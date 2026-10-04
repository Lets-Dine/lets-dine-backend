import { z } from "zod";

export const generateInvoicesSchema = z.object({
  /** How many days ahead of a period's end to issue its renewal invoice. Defaults to the platform setting. */
  leadDays: z.coerce.number().int().min(0).max(60).optional(),
});

export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;
