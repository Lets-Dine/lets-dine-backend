import { AuditAction, StaffRole } from "@prisma/client";

export interface IAuditLog {
  id: string;
  restaurantId: string;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  action: AuditAction;
  subject: string;
  detail: string;
  createdAt: Date;
}
