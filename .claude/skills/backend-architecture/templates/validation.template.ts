// interfaces/http/validations/{action}-{feature-name}.validation.ts
import { z } from "zod";

export const {action}{Feature}Schema = z.object({
  // define fields here, e.g.:
  // name: z.string().min(1),
  // isActive: z.boolean().optional().default(false),
});

export type {Action}{Feature}Dto = z.infer<typeof {action}{Feature}Schema>;

// For a fetch-all/list endpoint (fetch-{feature-name}s.validation.ts), spread the shared
// pagination schema instead of hand-rolling offset/limit/sortBy/sortOrder — it also brings in
// returnData/returnCount. See SKILL.md's "Pagination" section for the full contract.
// import { paginationSchema } from "@holista/core/dto";
//
// export const fetch{Feature}sSchema = z.object({
//   ...paginationSchema,
//   keyword: z.string().optional(),
// });
//
// export type Fetch{Feature}sQuery = z.infer<typeof fetch{Feature}sSchema>;
