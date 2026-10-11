import { z } from "zod";

export const completeDeliverySchema = z.object({
  /** What actually came back. Short cash is recorded, never refused. */
  cashCollected: z.number().int().min(0).max(100_000_000).default(0),
});

export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>;
