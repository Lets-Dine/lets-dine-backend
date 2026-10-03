import { z } from "zod";

/**
 * Delivery's landing step: a phone number, plus name/address the first time
 * — prefilled from the `Customer` row on every repeat order after that.
 */
export const startDeliverySessionSchema = z.object({
  restaurantSlug: z.string().min(1).max(80),
  /** Which branch should deliver. Defaults to the restaurant's default branch. */
  branchSlug: z.string().min(1).max(80).optional(),
  phone: z.string().min(6).max(20),
  name: z.string().min(1).max(120).optional(),
  address: z.string().min(1).max(500).optional(),
  note: z.string().max(280).optional(),
});

export type StartDeliverySessionInput = z.infer<typeof startDeliverySessionSchema>;
