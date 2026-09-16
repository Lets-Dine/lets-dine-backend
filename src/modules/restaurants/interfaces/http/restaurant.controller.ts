import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { UpdateRestaurantDto } from "../../application/dto/update-restaurant.dto";
import { FetchRestaurantProfileUsecase } from "../../application/use-cases/fetch-restaurant-profile.usecase";
import { UpdateRestaurantUsecase } from "../../application/use-cases/update-restaurant.usecase";
import { RESTAURANT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IRestaurant } from "../../domain/interfaces/restaurant.interface";

@Controller("restaurant/profile")
export class RestaurantController {
  constructor(
    private readonly fetchRestaurantProfileUsecase: FetchRestaurantProfileUsecase,
    private readonly updateRestaurantUsecase: UpdateRestaurantUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:view"], ["orders:view"]]))
  async fetchProfile(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRestaurant>> {
    const restaurant = await this.fetchRestaurantProfileUsecase.execute(authEntity);
    return buildHttpResponse(restaurant, RESTAURANT_SUCCESS_MESSAGES.RESTAURANT_FETCHED);
  }

  @Patch()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async update(@Body() dto: UpdateRestaurantDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRestaurant>> {
    const restaurant = await this.updateRestaurantUsecase.execute(dto, authEntity);
    return buildHttpResponse(restaurant, RESTAURANT_SUCCESS_MESSAGES.RESTAURANT_UPDATED);
  }
}
