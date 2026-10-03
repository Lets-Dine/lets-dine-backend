import { z } from "zod";

export const copyBranchMenuSchema = z.object({
  fromBranchId: z.string().uuid(),
});

export type CopyBranchMenuInput = z.infer<typeof copyBranchMenuSchema>;
