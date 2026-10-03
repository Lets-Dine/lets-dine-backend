import { StaffRole } from "@prisma/client";
import { z } from "zod";

export const updateStaffMemberSchema = z
  .object({
    role: z.nativeEnum(StaffRole).optional(),
    isActive: z.boolean().optional(),
    /** Replaces the member's branch assignments. */
    branchIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  })
  .refine(value => value.role !== undefined || value.isActive !== undefined || value.branchIds !== undefined, {
    message: "Provide a role, branches or an access change",
  });

export type UpdateStaffMemberInput = z.infer<typeof updateStaffMemberSchema>;
