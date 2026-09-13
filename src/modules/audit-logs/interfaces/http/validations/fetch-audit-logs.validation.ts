import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchAuditLogsSchema = z.object({
  ...paginationSchema,
  action: z.nativeEnum(AuditAction).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type FetchAuditLogsQuery = z.infer<typeof fetchAuditLogsSchema>;
