import { z } from "zod";

export const closeLedgerSchema = z.object({
  /** The cash physically in the drawer. On a branch's first close this is simply its opening float. */
  closingCounted: z.number().int().min(0),
  /** The bank (card / off-cash) balance as the bank shows it. On a first close, its opening balance. */
  bankCounted: z.number().int().min(0),
  note: z.string().trim().max(300).default(""),
});

export type CloseLedgerInput = z.infer<typeof closeLedgerSchema>;
