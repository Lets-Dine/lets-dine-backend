import { PrinterLink } from "@prisma/client";
import { z } from "zod";
import { createPrinterSchema } from "./create-printer.validation";

const shape = createPrinterSchema.innerType().partial();

export const updatePrinterSchema = shape
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" })
  .superRefine((value, ctx) => {
    if (value.link === undefined) return;
    if (value.link === PrinterLink.BLUETOOTH) {
      if (!value.deviceName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deviceName"], message: "Pick the Bluetooth printer on this PC" });
      }
      return;
    }
    if (!value.ipAddress || !/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value.ipAddress)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ipAddress"], message: "Enter an IP address like 192.168.1.50" });
    }
  });

export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;
