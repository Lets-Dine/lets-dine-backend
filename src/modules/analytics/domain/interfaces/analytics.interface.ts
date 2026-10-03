/**
 * What an analytics read covers. `branchIds` undefined = every branch of the restaurant (an owner's
 * whole-business view); otherwise only these. Always derived from the token by `resolveAnalyticsScope`.
 */
export interface IAnalyticsScope {
  restaurantId: string;
  branchIds?: string[];
}

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

/** One branch's slice of the restaurant's results — the cross-branch comparison an owner reads. */
export interface IBranchPerformance {
  branchId: string;
  branchName: string;
  orders: number;
  completed: number;
  cancelled: number;
  grossRevenue: number;
  averageOrderValue: number;
}

/** Paid-for dishes on a given day, ranked by units sold — sourced from `payments`, not `orders`. */
export interface ITopSellingDish {
  dishId: string;
  dishName: string;
  orderCount: number;
  totalAmount: number;
}
