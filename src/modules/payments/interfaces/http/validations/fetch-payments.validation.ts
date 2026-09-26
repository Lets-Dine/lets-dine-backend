import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchPaymentsSchema = z.object({
  ...paginationSchema,
  tableId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type FetchPaymentsQuery = z.infer<typeof fetchPaymentsSchema>;
