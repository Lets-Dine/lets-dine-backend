import { z } from "zod";

/**
 * Exactly what the floor QR link carries plus the one thing the floor itself
 * can't tell us: who/where this visit is for, since there is no table to
 * identify it by instead (§16b). No join code — floors never join.
 */
export const startFloorSessionSchema = z.object({
  restaurantSlug: z.string().min(1).max(80),
  floorToken: z.string().min(8).max(120),
  visitorName: z.string().min(1).max(60),
});

export type StartFloorSessionInput = z.infer<typeof startFloorSessionSchema>;
