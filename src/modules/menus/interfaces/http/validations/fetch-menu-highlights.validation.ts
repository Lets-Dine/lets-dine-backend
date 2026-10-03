import { z } from "zod";
import { DISH_RAIL_KEYS } from "../../../../dishes/domain/utils/dish-rails.util";

const railKey = z.enum(DISH_RAIL_KEYS as [string, ...string[]]);

export const fetchMenuHighlightsSchema = z.object({
  /** `?sections=loved,trending` — defaults to every rail, in menu order. */
  sections: z
    .union([railKey, z.array(railKey), z.string()])
    .optional()
    .transform(value => {
      if (value === undefined) return undefined;
      const keys = Array.isArray(value) ? value : String(value).split(",");
      return keys.map(key => key.trim()).filter(Boolean);
    })
    .pipe(z.array(railKey).optional()),
  /** Show this branch's menu — its overrides applied. Use the id from the diner's session, or a slug when browsing. */
  branchId: z.string().uuid().optional(),
  branchSlug: z.string().min(1).max(80).optional(),
  /** Overrides each rail's own cap — a phone rail shows fewer than a laptop grid. */
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export type FetchMenuHighlightsQuery = z.infer<typeof fetchMenuHighlightsSchema>;
