import { z } from "zod";

export const setDishAddOnsSchema = z.object({
  addOnIds: z.array(z.string().uuid()).max(50),
});

export type SetDishAddOnsInput = z.infer<typeof setDishAddOnsSchema>;
