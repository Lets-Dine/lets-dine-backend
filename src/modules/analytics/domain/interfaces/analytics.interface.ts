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

export type RevenueTrendPeriod = "week" | "month" | "year";

/** `week` and `month` read one bucket per day; `year` one per month. */
export type RevenueTrendGranularity = "day" | "month";

/**
 * One slot of the chart, with this period's figure beside the same slot of the one before it
 * (this Tuesday against last Tuesday, March 5th against February 5th, this April against last April).
 * `date` is the restaurant-local calendar date ("2026-01-14") or, for a yearly trend, month ("2026-01").
 */
export interface IRevenueTrendPoint {
  index: number;
  date: string;
  /** Null for a slot that has not happened yet. */
  current: number | null;
  /** Null when the previous period has no such slot (the 31st against a 30-day month). */
  previousDate: string | null;
  previous: number | null;
}

export interface IRevenueTrend {
  period: RevenueTrendPeriod;
  granularity: RevenueTrendGranularity;
  /** Revenue so far this period. */
  currentTotal: number;
  /** The whole of the previous period. */
  previousTotal: number;
  /** The previous period up to the same slot — the like-for-like figure `differencePercentage` is measured against. */
  previousToDate: number;
  differencePercentage: number;
  points: IRevenueTrendPoint[];
}

/** Revenue for one restaurant-local bucket, keyed like `IRevenueTrendPoint.date`. Empty buckets are absent. */
export interface IRevenueBucket {
  key: string;
  revenue: number;
}
