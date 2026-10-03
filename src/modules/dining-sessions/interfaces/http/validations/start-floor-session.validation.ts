import { z } from "zod";

/**
 * Exactly what the floor QR link carries. `visitorName` used to be collected
 * up front here; identity is now captured at order time instead (see
 * `createOrderSchema`'s `customer`), so it is optional and mostly a
 * backward-compatible fallback. No join code — floors never join.
 */
export const startFloorSessionSchema = z.object({
  restaurantSlug: z.string().min(1).max(80),
  floorToken: z.string().min(8).max(120),
  visitorName: z.string().max(60).optional(),
});

export type StartFloorSessionInput = z.infer<typeof startFloorSessionSchema>;
