import { z } from "zod";

/** A history window: `from` exclusive, `to` inclusive — the same edges a close uses. Neither given means the open period. */
// A month of days (31, plus a day of slack for clock changes) — a tape longer than that is a report, not something to load line by line.
const MAX_WINDOW_MS = 32 * 24 * 60 * 60 * 1000;

export const fetchLedgerEntriesSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(({ from, to }) => (!from && !to) || (from && to && from < to && to.getTime() - from.getTime() <= MAX_WINDOW_MS), {
    message: "from and to must both be given, from before to, at most 31 days apart",
  });

export type FetchLedgerEntriesQuery = z.infer<typeof fetchLedgerEntriesSchema>;
