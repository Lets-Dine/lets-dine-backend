import { z } from "zod";

const MAX_SPAN_DAYS = 366;

export const fetchWasteSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(q => !q.from || !q.to || q.from < q.to, { path: ["from"], message: "from must be before to" })
  .refine(q => !q.from || !q.to || q.to.getTime() - q.from.getTime() <= MAX_SPAN_DAYS * 86_400_000, {
    path: ["to"],
    message: `Choose a period of at most ${MAX_SPAN_DAYS} days`,
  });

export type FetchWasteInput = z.infer<typeof fetchWasteSchema>;
