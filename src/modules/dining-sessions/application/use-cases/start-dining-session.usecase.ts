import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
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
    const restaurant = await this.restaurantRepository.findBySlug(dto.restaurantSlug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const table = await this.diningTableRepository.findByQrToken(dto.tableToken);
    if (!table || !table.isActive || table.restaurantId !== restaurant.id) {
      throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND);
    }

    return this.diningTableRepository.$transaction(async tx => {
      if (dto.joinSessionId) {
        const activeSessionId = table.currentSessionId;
        const session = activeSessionId ? await this.diningSessionRepository.findById(activeSessionId, { tx }) : null;
        // A code only means something while the visit it was cut for is still open — once that
        // session has ended (or the table lost track of it entirely), there is nothing left to
        // join, so this falls through to seat the diner in a fresh session instead of erroring.
        if (session && !session.endedAt) {
          if (dto.joinSessionId !== session.anonymousSessionToken) {
            throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.JOIN_MISMATCH);
          }

          return { session, restaurant, table };
        }
      }

      // Stale sessions past their TTL don't block a fresh scan — end them and reseat the table.
      const openSession = await this.diningSessionRepository.findOpenByTableId(table.id, { tx });
      if (openSession) {
        if (openSession.expiresAt > new Date()) {
          throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED);
        }
        await this.diningSessionRepository.update(openSession.id, { endedAt: new Date() }, tx);
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

      return { session, restaurant, table: currentTable };
    });
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
