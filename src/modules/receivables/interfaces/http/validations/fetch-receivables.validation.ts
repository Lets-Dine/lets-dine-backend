import { z } from "zod";
import { RECEIVABLE_BUCKETS } from "../../../receivables.interface";

export const fetchReceivablesSchema = z.object({
  bucket: z.enum(RECEIVABLE_BUCKETS).optional(),
  sortBy: z.enum(["owed", "oldest", "name"]).default("owed"),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
