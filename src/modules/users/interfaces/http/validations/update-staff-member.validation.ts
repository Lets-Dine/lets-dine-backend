import { StaffRole } from "@prisma/client";
import { z } from "zod";
import { avatarUrlSchema, phoneSchema } from "./profile-fields.validation";

export const updateStaffMemberSchema = z
  .object({
    /** Details live on the person's account, so they only change for somebody who works nowhere else. */
    name: z.string().trim().min(2).max(120).optional(),
    phone: phoneSchema.nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    role: z.nativeEnum(StaffRole).optional(),
    isActive: z.boolean().optional(),
    /** Replaces the member's branch assignments. */
    branchIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  })
  .refine(
    value =>
      [value.name, value.phone, value.avatarUrl, value.role, value.isActive, value.branchIds].some(field => field !== undefined),
    { message: "Provide details, a role, branches or an access change" }
  );

export type UpdateStaffMemberInput = z.infer<typeof updateStaffMemberSchema>;
