import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchOrdersSchema = z.object({
  ...paginationSchema,
  /** Repeatable: ?status=PENDING&status=ACCEPTED. */
  status: z
    .union([z.nativeEnum(OrderStatus), z.array(z.nativeEnum(OrderStatus))])
    .optional()
    .transform(value => (value === undefined ? undefined : Array.isArray(value) ? value : [value])),
  tableId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type FetchOrdersQuery = z.infer<typeof fetchOrdersSchema>;
