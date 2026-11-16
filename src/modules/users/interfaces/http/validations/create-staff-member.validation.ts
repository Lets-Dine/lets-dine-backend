import { StaffRole } from "@prisma/client";
import { z } from "zod";
import { avatarUrlSchema, phoneSchema } from "./profile-fields.validation";

export const createStaffMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  /** §23 — staff sign in with a numeric PIN, not a password. */
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
  role: z.nativeEnum(StaffRole),
  /** Only used when this creates a new account; somebody who already has one keeps their own details. */
  phone: phoneSchema.optional(),
  avatarUrl: avatarUrlSchema.optional(),
  /** Branches a MANAGER/STAFF member works at. Defaults to the creator's active branch; ignored for an OWNER. */
  branchIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

export type CreateStaffMemberInput = z.infer<typeof createStaffMemberSchema>;
