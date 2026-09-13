import { Controller, Get, Param } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchRestaurantBySlugUsecase } from "../../application/use-cases/fetch-restaurant-by-slug.usecase";
import { RESTAURANT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";

/** §35 — diner-facing endpoints stay separate from the staff ones and need no auth. */
@Controller("public/restaurants")
export class PublicRestaurantController {
  constructor(private readonly fetchRestaurantBySlugUsecase: FetchRestaurantBySlugUsecase) {}

  @Get("/:slug")
  async fetchBySlug(@Param("slug") slug: string): Promise<IHttpResponse<IRestaurant>> {
    const restaurant = await this.fetchRestaurantBySlugUsecase.execute(slug);
    return buildHttpResponse(restaurant, RESTAURANT_SUCCESS_MESSAGES.RESTAURANT_FETCHED);
  }
}
