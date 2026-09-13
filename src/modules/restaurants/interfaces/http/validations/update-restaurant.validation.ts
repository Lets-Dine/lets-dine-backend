import { z } from "zod";

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().max(500).nullish(),
  currency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().min(1).max(60).optional(),
  /** §41 — fees are configuration, and changing them is an audited settings change. */
  serviceChargeRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
