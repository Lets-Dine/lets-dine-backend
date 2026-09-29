import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

const optionalBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform(value => (value === undefined ? undefined : value === true || value === "true"));

export const fetchAddOnsSchema = z.object({
  ...paginationSchema,
  keyword: z.string().optional(),
  isAvailable: optionalBoolean,
  isArchived: optionalBoolean,
});

export type FetchAddOnsQuery = z.infer<typeof fetchAddOnsSchema>;
