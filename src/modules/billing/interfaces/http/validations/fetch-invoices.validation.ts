import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchInvoicesSchema = z.object({ ...paginationSchema });

export type FetchInvoicesQuery = z.infer<typeof fetchInvoicesSchema>;
