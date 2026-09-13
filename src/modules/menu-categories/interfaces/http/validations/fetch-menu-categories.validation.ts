import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchMenuCategoriesSchema = z.object({
  ...paginationSchema,
  keyword: z.string().optional(),
});

export type FetchMenuCategoriesQuery = z.infer<typeof fetchMenuCategoriesSchema>;
