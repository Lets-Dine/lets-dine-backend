import { z } from "zod";

/** The base64 `data` query value eSewa appends to the success URL. */
export const confirmEsewaSchema = z.object({ data: z.string().trim().min(1).max(4096) });

export type ConfirmEsewaInput = z.infer<typeof confirmEsewaSchema>;
