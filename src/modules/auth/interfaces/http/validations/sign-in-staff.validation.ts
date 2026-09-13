import { z } from "zod";

export const signInStaffSchema = z.object({
  email: z.string().email().max(180),
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits"),
  /** Only needed by somebody who works at more than one restaurant. */
  restaurantId: z.string().uuid().optional(),
});

export type SignInStaffInput = z.infer<typeof signInStaffSchema>;
