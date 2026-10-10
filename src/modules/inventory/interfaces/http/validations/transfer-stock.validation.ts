import { z } from "zod";

export const transferStockSchema = z.object({
  toBranchId: z.string().uuid(),
  /** Base units to send. */
  quantity: z.number().int().min(1),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;
