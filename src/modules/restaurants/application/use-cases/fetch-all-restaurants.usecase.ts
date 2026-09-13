import { Injectable } from "@nestjs/common";
import { PaginatedResponse } from "../../../../common/interfaces";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";
import { RestaurantRepository } from "../../domain/repositories/restaurant.repository";
import { FetchRestaurantsQuery } from "../../interfaces/http/validations/fetch-restaurants.validation";

@Injectable()
export class FetchAllRestaurantsUsecase {
  constructor(private readonly restaurantRepository: RestaurantRepository) {}

  async execute(query: FetchRestaurantsQuery): Promise<PaginatedResponse<IRestaurant>> {
    const { keyword, isActive, ...pagination } = query;
    return this.restaurantRepository.fetchAll({ keyword, isActive }, pagination);
  }
}
