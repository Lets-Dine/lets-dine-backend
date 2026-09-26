import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { ComparisonPeriod, IRevenueComparison } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { comparisonPercentageDiff, resolveComparisonRanges } from "../../domain/utils/resolve-comparison-range.util";

/** §31 — current vs. previous revenue, scoped to the restaurant's own timezone. */
@Injectable()
export class FetchRevenueComparisonUsecase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(period: ComparisonPeriod, authEntity: AuthEntity): Promise<IRevenueComparison> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const timeZone = restaurant?.timezone ?? "UTC";

    const { current, previous } = resolveComparisonRanges(period, timeZone);
    const totals = await this.analyticsRepository.fetchRevenueComparison(authEntity.restaurantId, current, previous);

    return { ...totals, differencePercentage: comparisonPercentageDiff(totals.current, totals.previous) };
  }
}
