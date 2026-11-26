import { z } from "zod";

/** Deleting an account takes the sign-in PIN again, so a left-open phone cannot remove somebody's account. */
export const deleteOwnAccountSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
});

export type DeleteOwnAccountInput = z.infer<typeof deleteOwnAccountSchema>;
