import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchLedgerListSchema = z.object(paginationSchema);

export type FetchLedgerListQuery = z.infer<typeof fetchLedgerListSchema>;
