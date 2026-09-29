import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../tables/domain/constants";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { generateSessionToken, sessionExpiryFrom } from "../../domain/utils/session-token.util";

const DEFAULT_TTL_MINUTES = 180;

/**
 * Seats a table the QR never got to: a diner who can't or won't scan for
 * themselves, so staff open the visit on their behalf instead — the same
 * session a scan would have started. The controller gates this on
 * `orders:advance` rather than `tables:edit` — this is service, not table
 * configuration, so any server working the floor can do it, not only a manager.
 */
@Injectable()
export class StartTableSessionUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(tableId: string, authEntity: AuthEntity): Promise<IDiningTable> {
    const table = await this.diningTableRepository.findById(tableId);
    if (!table || table.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);
    }
    if (!table.isActive) throw new ConflictException(DINING_TABLE_ERROR_MESSAGES.INACTIVE);

    return this.diningTableRepository.$transaction(async tx => {
      await this.diningTableRepository.lockById(table.id, { tx });

      const existing = await this.diningSessionRepository.findOpenByTableId(table.id, { tx });
      if (existing) throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED);

      const startedAt = new Date();
      const session = await this.diningSessionRepository.create(
        {
          restaurantId: table.restaurantId,
          tableId: table.id,
          anonymousSessionToken: generateSessionToken(),
          expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
        },
        { tx }
      );

      const updated = await this.diningTableRepository.update(table.id, { currentSessionId: session.id }, { tx, actorId: authEntity.sub });

      await this.auditLogService.record(
        { action: AuditAction.table_session_started, subject: table.name, detail: "Seated by staff — no QR scan" },
        authEntity,
        tx
      );

      return updated;
    });
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
