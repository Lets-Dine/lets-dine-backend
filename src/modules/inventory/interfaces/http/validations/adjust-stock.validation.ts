import { z } from "zod";

export const adjustStockSchema = z.object({
  /** The counted quantity now on the shelf — the movement is whatever it takes to get there. */
  quantity: z.number().int().min(0),
  note: z.string().trim().max(200).default(""),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
