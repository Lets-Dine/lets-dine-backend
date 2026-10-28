import { z } from "zod";

/** The exact string QZ Tray handed the page. A slip's raw bytes fit well under this. */
export const signQzRequestSchema = z.object({ request: z.string().min(1).max(500_000) });
export type SignQzRequestInput = z.infer<typeof signQzRequestSchema>;
