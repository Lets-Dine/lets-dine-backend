import { z } from "zod";

/** `claimant` is the printing session's own token, so a slow PC can only release a job it still holds. */
export const failPrintJobSchema = z.object({ claimant: z.string().min(8).max(64), error: z.string().trim().min(1).max(300) });
export type FailPrintJobInput = z.infer<typeof failPrintJobSchema>;
