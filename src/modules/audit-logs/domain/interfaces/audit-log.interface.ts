import { AuditAction, StaffRole } from "@prisma/client";

export interface IAuditLog {
  id: string;
  restaurantId: string;
  /** The branch the actor was working in; null on entries that predate branches. */
  branchId: string | null;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  action: AuditAction;
  subject: string;
  detail: string;
  createdAt: Date;
}
