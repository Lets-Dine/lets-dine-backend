import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and dashes");

/** Onboarding: the restaurant and the owner who will run it, in one request. */
export const registerRestaurantSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  tagline: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().max(500).nullish(),
  currency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().min(1).max(60).optional(),
  serviceChargeRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  owner: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(180),
    pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
  }),
});

export type RegisterRestaurantInput = z.infer<typeof registerRestaurantSchema>;
