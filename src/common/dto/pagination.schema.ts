import { z } from "zod";

const booleanFlag = (fallback: boolean) =>
  z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .default(fallback)
    .transform(value => value === true || value === "true");

/**
 * Spread into every list endpoint's validation schema — never hand-roll
 * offset/limit/sortBy/sortOrder. No pagination is applied when `limit` is
 * omitted or zero.
 */
export const paginationSchema = {
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  returnData: booleanFlag(true),
  returnCount: booleanFlag(true),
};
