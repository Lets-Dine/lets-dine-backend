import { z } from "zod";

export const statementQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Opaque: the `nextCursor` of the previous page. */
  cursor: z.string().max(100).optional(),
});

export type StatementQuery = z.infer<typeof statementQuerySchema>;
