import { KitchenStation, PaperWidth } from "@prisma/client";
import { z } from "zod";

const octet = "(25[0-5]|2[0-4]\\d|1?\\d?\\d)";
/** A thermal printer on the LAN is addressed by its IPv4 address. */
const ipv4 = z
  .string()
  .trim()
  .regex(new RegExp(`^${octet}(\\.${octet}){3}$`), "Enter an IP address like 192.168.1.50");

/** Optional fields fall back to the database defaults (80mm, port 9100, everything off). */
export const createPrinterSchema = z.object({
  name: z.string().trim().min(1).max(40),
  ipAddress: ipv4,
  paperWidth: z.nativeEnum(PaperWidth).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  /** The whole order on one slip, every station together. */
  fullKot: z.boolean().optional(),
  /** KITCHEN = KOT, BAR = BOT. Ignored while `fullKot` is on. */
  stations: z
    .array(z.nativeEnum(KitchenStation))
    .max(2)
    .transform(stations => [...new Set(stations)])
    .optional(),
  tableAssignment: z.boolean().optional(),
  tableIds: z.array(z.string().uuid()).max(500).optional(),
  floorIds: z.array(z.string().uuid()).max(100).optional(),
  isActive: z.boolean().optional(),
  warnIfUnprinted: z.boolean().optional(),
});

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
