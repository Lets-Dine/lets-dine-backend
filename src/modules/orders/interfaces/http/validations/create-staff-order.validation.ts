import { z } from "zod";
import { createOrderSchema } from "./create-order.validation";

/**
 * Staff placing an order at the till — the diner's own cart body, plus where it goes. Staff
 * have no diner session, so `type` and its target name the one the order should land in
 * (an open table visit is reused, anything else gets a fresh one).
 */
export const createStaffOrderSchema = createOrderSchema
  .extend({
    type: z.enum(["TABLE", "FLOOR", "DELIVERY"]),
    tableId: z.string().uuid().optional(),
    floorId: z.string().uuid().optional(),
  })
  .refine(dto => dto.type !== "TABLE" || dto.tableId, { message: "Choose a table", path: ["tableId"] })
  .refine(dto => dto.type !== "FLOOR" || dto.floorId, { message: "Choose a floor", path: ["floorId"] })
  .refine(dto => dto.type !== "DELIVERY" || dto.customer, { message: "A delivery needs a customer", path: ["customer"] });

export type CreateStaffOrderInput = z.infer<typeof createStaffOrderSchema>;
