import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { IRevenueTrend, RevenueTrendPeriod } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { resolveAnalyticsScope } from "../../domain/utils/resolve-analytics-scope.util";
import { comparisonPercentageDiff } from "../../domain/utils/resolve-comparison-range.util";
import { resolveRevenueTrendPlan } from "../../domain/utils/resolve-revenue-trend.util";

/** §31 — revenue slot by slot (day for a week or month, month for a year) against the period before it. */
@Injectable()
export class FetchRevenueTrendUsecase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(period: RevenueTrendPeriod, authEntity: AuthEntity, branchId?: string): Promise<IRevenueTrend> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const timeZone = restaurant?.timezone ?? "UTC";

    const plan = resolveRevenueTrendPlan(period, timeZone);
    const buckets = await this.analyticsRepository.fetchRevenueByBucket(
      resolveAnalyticsScope(authEntity, branchId),
      plan.range,
      plan.granularity,
      timeZone
    );
    const revenueByKey = new Map(buckets.map(bucket => [bucket.key, bucket.revenue]));

    let currentTotal = 0;
    let previousTotal = 0;
    let previousToDate = 0;

    const points = plan.slots.map(slot => {
      const current = slot.index > plan.todayIndex ? null : (revenueByKey.get(slot.key) ?? 0);
      const previous = slot.previousKey === null ? null : (revenueByKey.get(slot.previousKey) ?? 0);

      currentTotal += current ?? 0;
      previousTotal += previous ?? 0;
      if (slot.index <= plan.todayIndex) previousToDate += previous ?? 0;

      return { index: slot.index, date: slot.key, current, previousDate: slot.previousKey, previous };
    });

    return {
      period,
      granularity: plan.granularity,
      currentTotal,
      previousTotal,
      previousToDate,
      differencePercentage: comparisonPercentageDiff(currentTotal, previousToDate),
      points,
    };
  }
}
