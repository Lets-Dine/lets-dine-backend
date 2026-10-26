import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";

/** Platform operator marks a restaurant claimed (owner verified) or unclaimed again. An existing claim keeps its original date. */
@Injectable()
export class SetRestaurantClaimedUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(id: string, claimed: boolean): Promise<IRestaurant> {
    const restaurant = await this.restaurantRepository.findById(id);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);
    if (claimed === Boolean(restaurant.claimedAt)) return restaurant;

    return this.restaurantRepository.update(id, { claimedAt: claimed ? new Date() : null });
  }
}
