import { z } from "zod";
import { MARGIN_SORTS } from "../../../dish-margins.interface";

export const fetchMarginsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(MARGIN_SORTS).default("marginPct"),
});
