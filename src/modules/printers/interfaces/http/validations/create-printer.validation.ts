import { KitchenStation, PaperWidth, PrinterLink } from "@prisma/client";
import { z } from "zod";

const octet = "(25[0-5]|2[0-4]\\d|1?\\d?\\d)";
/** A thermal printer on the LAN is addressed by its IPv4 address. */
const ipv4 = z
  .string()
  .trim()
  .regex(new RegExp(`^${octet}(\\.${octet}){3}$`), "Enter an IP address like 192.168.1.50");

const printerFields = {
  name: z.string().trim().min(1).max(40),
  /** Omitted means a network printer, so older clients keep working. */
  link: z.nativeEnum(PrinterLink).optional(),
  ipAddress: z.string().trim().optional(),
  /** The name QZ Tray lists for a Bluetooth printer or its serial port. */
  deviceName: z.string().trim().max(120).optional(),
  serial: z.boolean().optional(),
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
};

function checkLink(value: { link?: PrinterLink; ipAddress?: string; deviceName?: string }, ctx: z.RefinementCtx, partial: boolean) {
  const link = value.link ?? (partial ? undefined : PrinterLink.NETWORK);
  if (link === undefined) return;
  if (link === PrinterLink.BLUETOOTH) {
    if (!value.deviceName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deviceName"], message: "Pick the Bluetooth printer on this PC" });
    }
    return;
  }
  if (!value.ipAddress || !ipv4.safeParse(value.ipAddress).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ipAddress"], message: "Enter an IP address like 192.168.1.50" });
  }
}

/** Optional fields fall back to the database defaults (80mm, port 9100, everything off). */
export const createPrinterSchema = z.object(printerFields).superRefine((value, ctx) => checkLink(value, ctx, false));

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
