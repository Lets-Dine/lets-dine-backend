import { StaffRole } from "@prisma/client";
import { z } from "zod";

export const createStaffMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  /** §23 — staff sign in with a numeric PIN, not a password. */
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
  role: z.nativeEnum(StaffRole),
  /** Branches a MANAGER/STAFF member works at. Defaults to the creator's active branch; ignored for an OWNER. */
  branchIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

export type CreateStaffMemberInput = z.infer<typeof createStaffMemberSchema>;
