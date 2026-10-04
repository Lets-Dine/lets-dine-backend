import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const TENANT_VIEWS = ["all", "active", "trial", "attention", "closed"] as const;
export const TENANT_SORTS = ["active", "newest", "name", "revenue"] as const;

export const fetchPlatformTenantsSchema = z.object({
  ...paginationSchema,
  /** `sortBy` picks one of `TENANT_SORTS`; anything else falls back to the default. */
  view: z.enum(TENANT_VIEWS).optional().default("all"),
  planKey: z.string().trim().min(1).optional(),
  /** Matches name, slug, and the owner's name or email. */
  keyword: z.string().trim().min(1).optional(),
});

export type FetchPlatformTenantsQuery = z.infer<typeof fetchPlatformTenantsSchema>;
