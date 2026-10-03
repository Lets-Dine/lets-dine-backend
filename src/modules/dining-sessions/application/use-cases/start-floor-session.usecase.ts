import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { FloorRepository } from "../../../floors/domain/repositories/floor.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { generateSessionToken, sessionExpiryFrom } from "../../domain/utils/session-token.util";
import { StartFloorSessionInput } from "../../interfaces/http/validations/start-floor-session.validation";

const DEFAULT_TTL_MINUTES = 180;

/**
 * §16b — the floor counterpart of `StartDiningSessionUsecase`, deliberately
 * simpler: `Floor` has no `currentSessionId` singleton to join or lock
 * against, so every scan just creates its own fresh session. Any number of
 * staff can be mid-visit on the same floor QR at once. Identity (name/phone,
 * upserted as a `Customer`) is captured at order time now rather than here —
 * `visitorName` survives only as an optional legacy fallback.
 */
@Injectable()
export class StartFloorSessionUsecase {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly floorRepository: FloorRepository
  ) {}

  async execute(dto: StartFloorSessionInput): Promise<IResolvedSession> {
    const restaurant = await this.restaurantRepository.findBySlug(dto.restaurantSlug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const floor = await this.floorRepository.findByQrToken(dto.floorToken);
    if (!floor || !floor.isActive || floor.restaurantId !== restaurant.id) {
      throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.FLOOR_NOT_FOUND);
    }

    const startedAt = new Date();
    const session = await this.diningSessionRepository.create({
      restaurantId: floor.restaurantId,
      tableId: null,
      floorId: floor.id,
      floorVisitorName: dto.visitorName?.trim() || null,
      anonymousSessionToken: generateSessionToken(),
      expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
    });

    return { session, restaurant, table: null, floor };
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
