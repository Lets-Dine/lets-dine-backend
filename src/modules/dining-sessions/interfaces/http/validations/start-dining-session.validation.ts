import { z } from "zod";

/** Exactly what the QR link carries: /r/{restaurantSlug}/t/{tableToken}. */
export const startDiningSessionSchema = z.object({
  restaurantSlug: z.string().min(1).max(80),
  tableToken: z.string().min(8).max(120),
});

export type StartDiningSessionInput = z.infer<typeof startDiningSessionSchema>;
