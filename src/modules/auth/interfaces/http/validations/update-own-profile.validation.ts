import { z } from "zod";
import { avatarUrlSchema, phoneSchema } from "../../../../users/interfaces/http/validations/profile-fields.validation";

export const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    /** `null` clears it. */
    phone: phoneSchema.nullable().optional(),
    /** `null` removes the photo. */
    avatarUrl: avatarUrlSchema.nullable().optional(),
  })
  .refine(value => value.name !== undefined || value.phone !== undefined || value.avatarUrl !== undefined, {
    message: "Provide a name, phone number or photo",
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
