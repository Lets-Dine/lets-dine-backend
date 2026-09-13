import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchDishReviewsSchema = z.object({
  ...paginationSchema,
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  onlyWithComment: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform(value => (value === undefined ? undefined : value === true || value === "true")),
});

export type FetchDishReviewsQuery = z.infer<typeof fetchDishReviewsSchema>;
