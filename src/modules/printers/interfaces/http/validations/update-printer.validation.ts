import { z } from "zod";
import { createPrinterSchema } from "./create-printer.validation";

export const updatePrinterSchema = createPrinterSchema
  .partial()
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;
