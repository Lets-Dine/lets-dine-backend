import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { AuthEntity } from "../../../common/interfaces";
import { PrismaTransaction } from "../../../common/prisma";
import { IAuditLog } from "../domain/interfaces/audit-log.interface";
import { AuditLogRepository } from "../domain/repositories/audit-log.repository";

export interface IAuditEntryInput {
  action: AuditAction;
  /** Human-readable target, e.g. "Chicken Sekuwa" or "Order #1023". */
  subject: string;
  /** What changed, already formatted for display, e.g. "Rs. 420 → Rs. 450". */
  detail?: string;
}

/**
 * §51. Every management action that changes the menu, the tables, an order or
 * the settings goes through here. Actor identity is snapshotted from the token
 * so the entry still reads correctly after somebody leaves the team.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(entry: IAuditEntryInput, authEntity: AuthEntity, tx?: PrismaTransaction): Promise<IAuditLog> {
    return this.auditLogRepository.create(
      {
        restaurantId: authEntity.restaurantId,
        actorId: authEntity.sub,
        actorName: authEntity.name,
        actorRole: authEntity.role,
        action: entry.action,
        subject: entry.subject,
        detail: entry.detail ?? "",
      },
      { tx }
    );
  }
}
