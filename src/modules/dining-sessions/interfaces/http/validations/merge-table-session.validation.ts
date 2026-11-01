import { z } from "zod";

export const mergeTableSessionSchema = z.object({ targetTableId: z.string().uuid() });

export type MergeTableSessionInput = z.infer<typeof mergeTableSessionSchema>;
