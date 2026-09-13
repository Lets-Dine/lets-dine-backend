import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchRestaurantsSchema = z.object({
  ...paginationSchema,
  keyword: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform(value => (value === undefined ? undefined : value === true || value === "true")),
});

export type FetchRestaurantsQuery = z.infer<typeof fetchRestaurantsSchema>;
