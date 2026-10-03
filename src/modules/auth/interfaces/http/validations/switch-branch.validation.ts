import { z } from "zod";

export const switchBranchSchema = z.object({
  branchId: z.string().uuid(),
});

export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;
