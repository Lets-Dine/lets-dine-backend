import { z } from "zod";

const pin = z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits");

export const setApprovalPinSchema = z.object({
  /** The sign-in PIN: setting this is changing who can approve things, so it asks who is asking. */
  currentPin: pin,
  approvalPin: pin,
});

export type SetApprovalPinInput = z.infer<typeof setApprovalPinSchema>;
