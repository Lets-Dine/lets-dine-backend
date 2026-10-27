import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and dashes");

export const phoneSchema = z
  .string()
  .transform(value => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, "Enter a valid phone number"));

const ownerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
});

/** Onboarding: the restaurant and the owner who will run it, in one request. */
export const registerRestaurantSchema = z.object({
  name: z.string().min(1).max(120),
  /** Registered name printed on receipts. */
  legalName: z.string().trim().min(1).max(120),
  slug: slugSchema,
  tagline: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z
    .string()
    .url()
    .max(500)
    .nullish()
    .default(
      "https://static.vecteezy.com/system/resources/thumbnails/054/611/336/small_2x/wide-angle-foodgraphy-for-restaurant-with-copy-space-photo.jpg"
    ),
  googleUrl: z.string().url().max(500).nullish(),
  /** Platform only: false = we set it up and the owner has yet to claim it. Omitted = claimed. */
  claimed: z.boolean().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().min(1).max(60).optional(),
  serviceChargeRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  owner: ownerSchema.extend({ phone: phoneSchema.optional() }),
  /** Another restaurant's slug, from an invite link. An unknown code is ignored. */
  referralCode: z.string().trim().max(80).optional(),
});

/** Self sign-up: the same, but the owner must leave a phone number, which is what stops repeat trials. */
export const signUpRestaurantSchema = registerRestaurantSchema.extend({ owner: ownerSchema.extend({ phone: phoneSchema }) });

export const claimRestaurantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
});

export const setClaimedSchema = z.object({ claimed: z.boolean() });

export type RegisterRestaurantInput = z.infer<typeof registerRestaurantSchema>;
export type SignUpRestaurantInput = z.infer<typeof signUpRestaurantSchema>;
