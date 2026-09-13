import { StaffRole } from "@prisma/client";
import { z } from "zod";

export const updateStaffMemberSchema = z
  .object({
    role: z.nativeEnum(StaffRole).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(value => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide a role or an access change",
  });

export type UpdateStaffMemberInput = z.infer<typeof updateStaffMemberSchema>;
