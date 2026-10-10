import { z } from "zod";

export const consumeStockSchema = z
  .object({
    /** How much was used, in the ingredient's base unit. */
    quantity: z.number().int().min(1),
    /** The dish it was used for. Left out for waste, a staff meal or anything that is not a dish. */
    dishId: z.string().uuid().optional(),
    /** Why, when it was not for a dish. */
    note: z.string().trim().max(200).default(""),
    /** When it was used, for use entered late. Defaults to now; never in the future. */
    usedAt: z.string().datetime().optional(),
  })
  .refine(d => !d.usedAt || new Date(d.usedAt).getTime() <= Date.now() + 60_000, {
    path: ["usedAt"],
    message: "Stock cannot be used in the future",
  });

export type ConsumeStockInput = z.infer<typeof consumeStockSchema>;
