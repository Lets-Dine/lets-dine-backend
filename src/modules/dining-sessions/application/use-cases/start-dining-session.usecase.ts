import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { generateSessionToken, sessionExpiryFrom } from "../../domain/utils/session-token.util";
import { StartDiningSessionInput } from "../../interfaces/http/validations/start-dining-session.validation";

const DEFAULT_TTL_MINUTES = 180;

@Injectable()
export class StartDiningSessionUsecase {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly diningTableRepository: DiningTableRepository
  ) {}

  async execute(dto: StartDiningSessionInput): Promise<IResolvedSession> {
    const table = await this.diningTableRepository.findByQrToken(dto.tableToken);
    if (!table || !table.isActive) throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND);

    return this.diningTableRepository.$transaction(async tx => {
      const activeSessionId = table.currentSessionId;
      if (activeSessionId) {
        if (!dto.joinSessionId) throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED);
        const session = await this.diningSessionRepository.findById(activeSessionId, { tx });
        if (!session || dto.joinSessionId !== session.anonymousSessionToken) {
          throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.JOIN_MISMATCH);
        }

        return { session, table };
      }

      const startedAt = new Date();
      const session = await this.diningSessionRepository.create(
        {
          tableId: table.id,
          restaurantId: table.restaurantId,
          anonymousSessionToken: generateSessionToken(),
          expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
        },
        { tx }
      );
      await this.diningTableRepository.update(table.id, { currentSessionId: session.id }, { tx });
      const currentTable = { ...table, currentSessionId: session.id };

      return { session, table: currentTable };
    });
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
