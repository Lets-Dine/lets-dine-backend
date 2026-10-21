import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

const paymentFilters = {
  tableId: z.string().uuid().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  /** Any collection taken by this method, so a split bill matches both of its methods. */
  method: z.nativeEnum(PaymentMethod).optional(),
  customerId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

export const fetchPaymentsSchema = z.object({ ...paginationSchema, ...paymentFilters });
/** The same filters with no paging: the totals are over every match, not one page of them. */
export const fetchPaymentsSummarySchema = z.object(paymentFilters);

export type FetchPaymentsQuery = z.infer<typeof fetchPaymentsSchema>;
export type FetchPaymentsSummaryQuery = z.infer<typeof fetchPaymentsSummarySchema>;
