import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PlatformGuard } from "../../../../common/auth";
import { IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { SetClaimedDto } from "../../application/dto/set-claimed.dto";
import { SetRestaurantClaimedUsecase } from "../../application/use-cases/set-restaurant-claimed.usecase";
import { FetchRestaurantsDto } from "../../application/dto/fetch-restaurants.dto";
import { RegisterRestaurantDto } from "../../application/dto/register-restaurant.dto";
import { FetchAllRestaurantsUsecase } from "../../application/use-cases/fetch-all-restaurants.usecase";
import { IRegisteredRestaurant, RegisterRestaurantUsecase } from "../../application/use-cases/register-restaurant.usecase";
import { RESTAURANT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";

/** §4.4 — deliberately minimal platform administration, behind a shared key. */
@Controller("platform/restaurants")
@UseGuards(PlatformGuard)
export class PlatformRestaurantController {
  constructor(
    private readonly registerRestaurantUsecase: RegisterRestaurantUsecase,
    private readonly fetchAllRestaurantsUsecase: FetchAllRestaurantsUsecase,
    private readonly setRestaurantClaimedUsecase: SetRestaurantClaimedUsecase
  ) {}

  @Post()
  async register(@Body() dto: RegisterRestaurantDto): Promise<IHttpResponse<IRegisteredRestaurant>> {
    const registered = await this.registerRestaurantUsecase.execute(dto);
    return buildHttpResponse(registered, RESTAURANT_SUCCESS_MESSAGES.RESTAURANT_CREATED);
  }

  @Patch("/:id/claimed")
  async setClaimed(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetClaimedDto): Promise<IHttpResponse<IRestaurant>> {
    const restaurant = await this.setRestaurantClaimedUsecase.execute(id, dto.claimed);
    return buildHttpResponse(restaurant, RESTAURANT_SUCCESS_MESSAGES.RESTAURANT_UPDATED);
  }

  @Get()
  async fetchAll(@Query() query: FetchRestaurantsDto): Promise<IHttpResponse<PaginatedResponse<IRestaurant>>> {
    const restaurants = await this.fetchAllRestaurantsUsecase.execute(query);
    return buildHttpResponse(restaurants, RESTAURANT_SUCCESS_MESSAGES.RESTAURANTS_FETCHED);
  }
}
