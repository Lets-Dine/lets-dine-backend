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

/**
 * §5.1/§21 — scanning the QR is the whole entry flow: the diner never picks a
 * restaurant or a table by hand, and never creates an account.
 */
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
    // §16 — a disabled table, or a code printed for another restaurant, stops resolving.
    if (!table || !table.isActive || table.restaurantId !== restaurant.id) {
      throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.TABLE_NOT_FOUND);
    }

    return this.diningTableRepository.$transaction(async tx => {
      await this.diningTableRepository.lockById(table.id, { tx });
      let currentTable = (await this.diningTableRepository.findById(table.id, { tx })) ?? table;
      const openSession = await this.diningSessionRepository.findOpenByTableId(table.id, { tx });
      console.log("openSession", openSession);

      if (openSession && openSession.expiresAt.getTime() > Date.now()) {
        if (currentTable.currentSessionId !== openSession.id) {
          currentTable = await this.diningTableRepository.update(table.id, { currentSessionId: openSession.id }, { tx });
        }

        if (!dto.joinSessionId) {
          throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.TABLE_OCCUPIED);
        }
        if (dto.joinSessionId !== openSession.id) {
          throw new ConflictException(DINING_SESSION_ERROR_MESSAGES.JOIN_MISMATCH);
        }

        return { session: openSession, restaurant, table: currentTable };
      }

      if (openSession) {
        await this.diningSessionRepository.update(openSession.id, { endedAt: new Date() }, tx);
      }

      const startedAt = new Date();
      const session = await this.diningSessionRepository.create(
        {
          restaurantId: restaurant.id,
          tableId: table.id,
          anonymousSessionToken: generateSessionToken(),
          expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
        },
        { tx }
      );
      currentTable = await this.diningTableRepository.update(table.id, { currentSessionId: session.id }, { tx });

      return { session, restaurant, table: currentTable };
    });
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
