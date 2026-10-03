import { PrismaTransaction } from "../../../../common/prisma";
import {
  IAnalyticsRange,
  IDishPerformance,
  IFeedbackSummary,
  IHourlyOrders,
  IOrderComparisonTotals,
  IOrderSummary,
  IRevenueTotals,
  ITopSellingDish,
} from "../interfaces/analytics.interface";

export interface AnalyticsFetchOptions {
  tx?: PrismaTransaction;
  /** How many dishes the performance table returns. */
  dishLimit?: number;
}

export abstract class AnalyticsRepository {
  abstract fetchOrderSummary(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IOrderSummary>;
  abstract fetchDishPerformance(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IDishPerformance[]>;
  abstract fetchFeedbackSummary(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IFeedbackSummary>;
  abstract fetchBusiestHours(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IHourlyOrders[]>;
  abstract fetchRevenueComparison(
    restaurantId: string,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IRevenueTotals>;
  abstract fetchOrderComparison(
    restaurantId: string,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IOrderComparisonTotals>;
  /** §31 — units actually paid for on the day, ranked highest-first; `range` is one calendar day. */
  abstract fetchTopSellingDishes(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<ITopSellingDish[]>;
}
