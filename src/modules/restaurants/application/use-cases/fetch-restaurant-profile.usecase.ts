import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RESTAURANT_ERROR_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";

@Injectable()
export class FetchRestaurantProfileUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(authEntity: AuthEntity): Promise<IRestaurant> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    return restaurant;
  }
}
