import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { CustomerRepository } from "../../../customers/domain/repositories/customer.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { generateSessionToken, sessionExpiryFrom } from "../../domain/utils/session-token.util";
import { StartDeliverySessionInput } from "../../interfaces/http/validations/start-delivery-session.validation";

const DEFAULT_TTL_MINUTES = 180;

/**
 * The delivery counterpart of `StartDiningSessionUsecase` — no QR, no table.
 * A phone number is the diner's whole identity; repeat customers are
 * recognised by `(restaurantId, phone)` and their name/address prefilled.
 */
@Injectable()
export class StartDeliverySessionUsecase {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  async execute(dto: StartDeliverySessionInput): Promise<IResolvedSession> {
    const restaurant = await this.restaurantRepository.findBySlug(dto.restaurantSlug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const existing = await this.customerRepository.findByPhone(restaurant.id, dto.phone);
    if (!existing && !dto.name) {
      throw new BadRequestException(DINING_SESSION_ERROR_MESSAGES.CUSTOMER_NAME_REQUIRED);
    }

    const customer = await this.customerRepository.upsert({
      restaurantId: restaurant.id,
      phone: dto.phone,
      name: dto.name ?? existing?.name ?? "",
      defaultAddress: dto.address ?? existing?.defaultAddress ?? null,
      defaultNote: dto.note ?? existing?.defaultNote ?? null,
    });

    const startedAt = new Date();
    const session = await this.diningSessionRepository.create({
      restaurantId: restaurant.id,
      tableId: null,
      customerId: customer.id,
      anonymousSessionToken: generateSessionToken(),
      expiresAt: sessionExpiryFrom(startedAt, this.ttlMinutes()),
    });

    return { session, restaurant, table: null, customer };
  }

  private ttlMinutes(): number {
    const configured = Number(process.env.DINING_SESSION_TTL_MINUTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  }
}
