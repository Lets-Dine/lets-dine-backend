import { z } from "zod";

export const assignDeliverySchema = z.object({
  riderId: z.string().uuid().nullable().default(null),
  partnerId: z.string().uuid().nullable().default(null),
  /** What the branch will owe the courier for this run, in minor units. */
  courierFee: z.number().int().min(0).max(100_000_000),
  /** Cash the courier takes at the door. 0 when the order is already paid or the courier does not collect. */
  cashToCollect: z.number().int().min(0).max(100_000_000).default(0),
});

export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;
