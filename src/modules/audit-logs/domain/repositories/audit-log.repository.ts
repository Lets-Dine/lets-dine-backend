import { AuditAction, StaffRole } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IAuditLog } from "../interfaces/audit-log.interface";

export interface IAuditLogCreate {
  restaurantId: string;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  action: AuditAction;
  subject: string;
  detail?: string;
}

export interface IAuditLogsFetchQuery {
  restaurantId: string;
  action?: AuditAction;
  actorId?: string;
  from?: Date;
  to?: Date;
}

export interface IAuditLogsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class AuditLogRepository {
  abstract create(data: IAuditLogCreate, options?: { tx?: PrismaTransaction }): Promise<IAuditLog>;
  abstract fetchAll(query: IAuditLogsFetchQuery, options?: IAuditLogsFetchOptions): Promise<PaginatedResponse<IAuditLog>>;
}
