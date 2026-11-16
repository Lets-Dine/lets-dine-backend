import { z } from "zod";

const pin = z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits");

export const changeOwnPinSchema = z
  .object({ currentPin: pin, newPin: pin })
  .refine(value => value.currentPin !== value.newPin, { message: "Choose a PIN different from the current one", path: ["newPin"] });

export type ChangeOwnPinInput = z.infer<typeof changeOwnPinSchema>;
