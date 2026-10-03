import { PrismaTransaction } from "../../../../common/prisma";
import {
  IAnalyticsRange,
  IAnalyticsScope,
  IBranchPerformance,
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
  abstract fetchOrderSummary(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IOrderSummary>;
  abstract fetchDishPerformance(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IDishPerformance[]>;
  abstract fetchFeedbackSummary(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IFeedbackSummary>;
  abstract fetchBusiestHours(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IHourlyOrders[]>;
  abstract fetchRevenueComparison(
    scope: IAnalyticsScope,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IRevenueTotals>;
  abstract fetchOrderComparison(
    scope: IAnalyticsScope,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IOrderComparisonTotals>;
  /** §31 — units actually paid for on the day, ranked highest-first; `range` is one calendar day. */
  abstract fetchTopSellingDishes(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<ITopSellingDish[]>;
  /** One row per branch in scope, highest revenue first — branches with no orders in the range still appear. */
  abstract fetchBranchPerformance(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IBranchPerformance[]>;
}
