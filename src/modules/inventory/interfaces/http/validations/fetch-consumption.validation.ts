import { z } from "zod";

export const fetchConsumptionSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    source: z.enum(["order", "manual", "waste"]).optional(),
    ingredientId: z.string().uuid().optional(),
    /** Inclusive start, exclusive end — the web sends midnights. */
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(q => !q.from || !q.to || q.from < q.to, { path: ["from"], message: "from must be before to" });

export type FetchConsumptionInput = z.infer<typeof fetchConsumptionSchema>;
