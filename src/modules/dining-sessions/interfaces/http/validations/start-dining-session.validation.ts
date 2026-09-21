import { z } from "zod";

/** Exactly what the QR link carries: /r/{restaurantSlug}/t/{tableToken}. */
export const startDiningSessionSchema = z.object({
  restaurantSlug: z.string().min(1).max(80),
  tableToken: z.string().min(8).max(120),
  joinSessionId: z
    .string()
    .regex(/^\d{8}$/, "Session code must be 8 digits")
    .optional(),
});

export type StartDiningSessionInput = z.infer<typeof startDiningSessionSchema>;
