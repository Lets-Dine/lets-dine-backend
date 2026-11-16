import { z } from "zod";

/** The same rule the sign-up form applies: a 10 digit mobile number, digits only. */
export const phoneSchema = z.string().trim().regex(/^\d{10}$/, "Enter a 10 digit phone number");

/** A profile photo is an uploaded image, so it must be an https URL. */
export const avatarUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine(url => url.startsWith("https://"), "The photo must be an https image URL");
