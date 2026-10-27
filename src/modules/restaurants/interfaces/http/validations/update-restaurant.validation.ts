import { z } from "zod";
import { phoneSchema } from "./register-restaurant.validation";

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  /** Registered name printed on receipts. Omitted leaves it unchanged; empty is refused. */
  legalName: z.string().trim().min(1).max(120).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().max(5000).nullish(),
  logoUrl: z.string().url().max(5000).nullish(),
  currency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().min(1).max(60).optional(),
  /** §41 — fees are configuration, and changing them is an audited settings change. */
  serviceChargeRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  /** Flat minor-unit delivery charge; null clears it back to "no fee". */
  deliveryFeeAmount: z.number().int().min(0).nullish(),
  /** Off = no delivery orders; the menu stays visible. */
  deliveryEnabled: z.boolean().optional(),
  deliveryChannel: z.enum(["APP", "WHATSAPP"]).optional(),
  /** Same rule as the owner phone at sign-up, with the country code included (wa.me needs it). Empty clears it; "+", spaces and dashes are dropped. */
  whatsappNumber: z
    .string()
    .trim()
    .nullish()
    .transform(v => (v === undefined ? undefined : v || null))
    .pipe(phoneSchema.nullish())
    .transform(v => (v ? v.replace(/\D/g, "") : v)),
  /** Whether starting a dish takes its recipe off stock. */
  autoConsumeStock: z.boolean().optional(),
  /** VAT/PAN registration number for receipts; null/empty clears it. */
  vatPanNumber: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .transform(v => (v === undefined ? undefined : v || null)),
  /** Pinned on a map; the name is free text the owner can edit. Send all three, or all null to clear. */
  addressName: z.string().trim().min(1).max(200).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  isActive: z.boolean().optional(),
}).refine(d => (d.latitude == null) === (d.longitude == null), { message: "latitude and longitude go together", path: ["latitude"] });

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
