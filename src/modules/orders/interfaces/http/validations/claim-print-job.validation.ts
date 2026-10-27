import { z } from "zod";

export const claimPrintJobSchema = z.object({ claimant: z.string().min(8).max(64) });
export type ClaimPrintJobInput = z.infer<typeof claimPrintJobSchema>;
