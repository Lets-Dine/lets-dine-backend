import { StaffRole } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const fetchStaffMembersSchema = z.object({
  ...paginationSchema,
  keyword: z.string().optional(),
  role: z.nativeEnum(StaffRole).optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform(value => (value === undefined ? undefined : value === true || value === "true")),
});

export type FetchStaffMembersQuery = z.infer<typeof fetchStaffMembersSchema>;
