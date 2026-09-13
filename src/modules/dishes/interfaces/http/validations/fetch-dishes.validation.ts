import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

const optionalBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform(value => (value === undefined ? undefined : value === true || value === "true"));

export const fetchDishesSchema = z.object({
  ...paginationSchema,
  keyword: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isAvailable: optionalBoolean,
  isArchived: optionalBoolean,
  isFeatured: optionalBoolean,
});

export type FetchDishesQuery = z.infer<typeof fetchDishesSchema>;
