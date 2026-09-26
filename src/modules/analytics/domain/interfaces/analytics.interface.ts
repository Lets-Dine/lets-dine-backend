export interface IAnalyticsRange {
  from: Date;
  to: Date;
}

/** §31 — the four numbers a manager actually asks for, in minor units. */
export interface IOrderSummary {
  total: number;
  completed: number;
  cancelled: number;
  grossRevenue: number;
  netRevenue: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  averageOrderValue: number;
}

export interface IDishPerformance {
  dishId: string;
  name: string;
  quantity: number;
  revenue: number;
  avgRating: number | null;
  ratingCount: number;
}

export interface IFeedbackSummary {
  ratingCount: number;
  avgRating: number | null;
  recommendRate: number | null;
  distribution: [number, number, number, number, number];
  topTags: { tag: string; count: number }[];
}

export interface IHourlyOrders {
  hour: number;
  orders: number;
}

export interface IAnalyticsOverview {
  range: IAnalyticsRange;
  orders: IOrderSummary;
  dishes: IDishPerformance[];
  feedback: IFeedbackSummary;
  busiestHours: IHourlyOrders[];
}

export type ComparisonPeriod = "today" | "week" | "month";

export interface IRevenueTotals {
  current: number;
  previous: number;
}

export interface IRevenueComparison extends IRevenueTotals {
  differencePercentage: number;
}

export interface IOrderComparisonTotals {
  current: number;
  previous: number;
}

export interface IOrderComparison extends IOrderComparisonTotals {
  differencePercentage: number;
}
