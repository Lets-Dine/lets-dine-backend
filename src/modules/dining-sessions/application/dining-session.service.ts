import { Injectable } from "@nestjs/common";
import { UnauthorizedException } from "../../../common/exceptions";
import { PrismaTransaction } from "../../../common/prisma";
import { DiningTableRepository } from "../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../domain/constants";
import { IDiningSession } from "../domain/interfaces/dining-session.interface";
import { DiningSessionRepository } from "../domain/repositories/dining-session.repository";
import { AuthEntity } from "../../../common/interfaces";
import { IDiningTable } from "../../tables/domain/interfaces/dining-table.interface";
import { OrderRepository } from "../../orders/domain/repositories/order.repository";
import { AuditLogService } from "../../audit-logs/application/audit-log.service";
import { AuditAction } from "@prisma/client";

/**
 * The one place a diner's token becomes a session. Everything the diner can do —
 * ordering, reviewing — hangs off this check, so it lives in a service rather
 * than being re-implemented per use case.
 */
@Injectable()
export class DiningSessionService {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly orderRepository: OrderRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async resolveActive(token: string, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const session = await this.diningSessionRepository.findByToken(token, options);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    if (session.endedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    const table = await this.diningTableRepository.findById(session.tableId, options);
    if (!table || table.currentSessionId !== session.id) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    return session;
  }

  async endSession(session: IDiningSession, authEntity: AuthEntity, tx: PrismaTransaction): Promise<IDiningTable> {
    const completed = await this.orderRepository.settleOpenBySessionId(session.id, authEntity.restaurantId, { tx });
    await this.diningSessionRepository.update(session.id, { endedAt: new Date() }, tx);
    const table = await this.diningTableRepository.update(session.tableId, { currentSessionId: null }, { tx });

    await this.auditLogService.record(
      {
        action: AuditAction.table_session_ended,
        subject: table.name,
        detail:
          completed > 0 ? `Table cleared — ${completed} order${completed === 1 ? "" : "s"} marked completed` : "Table cleared for the next visit",
      },
      authEntity,
      tx
    );

    return table;
  }
}
