import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";
import { ClaimRestaurantDto } from "../dto/claim-restaurant.dto";

/** An owner asks to take over a restaurant we set up. Nothing changes until the team verifies and sets `claimedAt`. */
@Injectable()
export class RequestRestaurantClaimUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(slug: string, dto: ClaimRestaurantDto): Promise<void> {
    const restaurant = await this.restaurantRepository.findBySlug(slug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);
    if (restaurant.claimedAt) throw new ConflictException(RESTAURANT_ERROR_MESSAGES.ALREADY_CLAIMED);

    await this.restaurantRepository.createClaimRequest({ restaurantId: restaurant.id, name: dto.name, phone: dto.phone });
  }
}
