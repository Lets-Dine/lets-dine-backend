import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
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

    const startedAt = new Date();
    const session = await this.diningSessionRepository.create({
      restaurantId: restaurant.id,
      tableId: table.id,
      anonymousSessionToken: generateSessionToken(),
      expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
    });

    return { session, restaurant, table };
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
