import { WasteReason } from "@prisma/client";
import { z } from "zod";

export const logWasteSchema = z.object({
  /** How much was thrown away, in the ingredient's base unit. */
  quantity: z.number().int().min(1),
  reason: z.nativeEnum(WasteReason),
  note: z.string().trim().max(200).default(""),
});

export type LogWasteInput = z.infer<typeof logWasteSchema>;
