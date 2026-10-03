import { z } from "zod";
import { createBranchSchema } from "./create-branch.validation";

export const updateBranchSchema = createBranchSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
