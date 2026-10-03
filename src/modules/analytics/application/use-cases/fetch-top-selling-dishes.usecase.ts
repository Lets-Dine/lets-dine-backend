import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ITopSellingDish } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { startOfZonedDay } from "../../domain/utils/resolve-comparison-range.util";
import { FetchTopSellingDishesQuery } from "../../interfaces/http/validations/fetch-top-selling-dishes.validation";

const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH = new Date(0);

export const TOP_SELLING_DISHES_ERROR_MESSAGES = {
  END_DATE_WITHOUT_START_DATE: {
    key: "TOP_SELLING_DISHES_END_DATE_WITHOUT_START_DATE",
    message: "endDate requires a startDate",
  },
  INVALID_RANGE: {
    key: "TOP_SELLING_DISHES_INVALID_RANGE",
    message: "endDate must not come before startDate",
  },
};

/**
 * §31 — no dates: everything up to now. `startDate` alone: that one day.
 * Both: that inclusive range. Day boundaries are the restaurant's own
 * timezone, same as `FetchRevenueComparisonUsecase`.
 */
@Injectable()
export class FetchTopSellingDishesUsecase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(query: FetchTopSellingDishesQuery, authEntity: AuthEntity): Promise<ITopSellingDish[]> {
    if (query.endDate && !query.startDate) throw new BadRequestException(TOP_SELLING_DISHES_ERROR_MESSAGES.END_DATE_WITHOUT_START_DATE);

    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const timeZone = restaurant?.timezone ?? "UTC";

    const from = query.startDate ? startOfZonedDay(query.startDate, timeZone) : EPOCH;
    const to = query.startDate ? startOfZonedDay(query.endDate ?? query.startDate, timeZone).getTime() + DAY_MS : Date.now();

    if (from.getTime() > to) throw new BadRequestException(TOP_SELLING_DISHES_ERROR_MESSAGES.INVALID_RANGE);

    return this.analyticsRepository.fetchTopSellingDishes(authEntity.restaurantId, { from, to: new Date(to) });
  }
}
