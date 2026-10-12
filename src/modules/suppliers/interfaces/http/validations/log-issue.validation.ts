import { SupplierIssueKind } from "@prisma/client";
import { z } from "zod";

export const logIssueSchema = z.object({
  supplier: z.string().trim().min(1).max(80),
  kind: z.nativeEnum(SupplierIssueKind),
  note: z.string().trim().max(300).default(""),
});

export type LogIssueInput = z.infer<typeof logIssueSchema>;
