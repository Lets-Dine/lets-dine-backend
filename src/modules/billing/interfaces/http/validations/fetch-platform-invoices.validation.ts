import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchPlatformInvoicesSchema = z.object({
  ...paginationSchema,
  restaurantId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
});

export type FetchPlatformInvoicesQuery = z.infer<typeof fetchPlatformInvoicesSchema>;
