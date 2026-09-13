import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { IAnalyticsOverview, IAnalyticsRange } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { FetchAnalyticsQuery } from "../../interfaces/http/validations/fetch-analytics.validation";

const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ANALYTICS_ERROR_MESSAGES = {
  INVALID_RANGE: { key: "ANALYTICS_INVALID_RANGE", message: "The end of the range must come after its start" },
};

/** §31 — one call behind the whole analytics screen. */
@Injectable()
export class FetchAnalyticsOverviewUsecase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async execute(query: FetchAnalyticsQuery, authEntity: AuthEntity): Promise<IAnalyticsOverview> {
    const range = this.resolveRange(query);
    const options = { dishLimit: query.dishLimit };

    const [orders, dishes, feedback, busiestHours] = await Promise.all([
      this.analyticsRepository.fetchOrderSummary(authEntity.restaurantId, range, options),
      this.analyticsRepository.fetchDishPerformance(authEntity.restaurantId, range, options),
      this.analyticsRepository.fetchFeedbackSummary(authEntity.restaurantId, range, options),
      this.analyticsRepository.fetchBusiestHours(authEntity.restaurantId, range, options),
    ]);

    return { range, orders, dishes, feedback, busiestHours };
  }

  private resolveRange(query: FetchAnalyticsQuery): IAnalyticsRange {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);

    if (from.getTime() > to.getTime()) throw new BadRequestException(ANALYTICS_ERROR_MESSAGES.INVALID_RANGE);

    return { from, to };
  }
}
