import { BillingInterval } from "@prisma/client";
import { z } from "zod";

export const assignPlanSchema = z.object({
  /** Any plan, including ones that are not offered for self-service. */
  planKey: z.string().trim().min(1),
  interval: z.nativeEnum(BillingInterval).optional(),
  extraBranches: z.number().int().min(0).optional(),
  extraSeats: z.number().int().min(0).optional(),
});

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
