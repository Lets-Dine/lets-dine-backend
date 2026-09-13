import { PrismaTransaction } from "../../../../common/prisma";
import { IAnalyticsRange, IDishPerformance, IFeedbackSummary, IHourlyOrders, IOrderSummary } from "../interfaces/analytics.interface";

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
}
