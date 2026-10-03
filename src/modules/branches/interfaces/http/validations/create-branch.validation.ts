import { z } from "zod";

const rate = z.number().min(0).max(1);

export const createBranchSchema = z.object({
  name: z.string().min(1).max(60),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().min(1).max(60).optional(),
  serviceChargeRate: rate.nullable().optional(),
  taxRate: rate.nullable().optional(),
  deliveryFeeAmount: z.number().int().min(0).nullable().optional(),
  /** Start this branch's menu as a copy of another branch's. Without it the new branch has an empty menu. */
  copyMenuFrom: z.string().uuid().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
