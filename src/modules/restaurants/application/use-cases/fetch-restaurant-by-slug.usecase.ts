import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";

/** The public lookup behind the QR link — a deactivated restaurant reads as gone. */
@Injectable()
export class FetchRestaurantBySlugUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(slug: string): Promise<IRestaurant> {
    const restaurant = await this.restaurantRepository.findBySlug(slug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    return restaurant;
  }
}
