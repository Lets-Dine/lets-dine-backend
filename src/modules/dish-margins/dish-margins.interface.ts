export const MARGIN_SORTS = ["marginPct", "margin", "units", "name"] as const;
export type MarginSort = (typeof MARGIN_SORTS)[number];

/** One dish's food-cost picture over a date range. Money is integer minor units, and costs are food only. */
export interface IDishMargin {
  dishId: string;
  name: string;
  price: number;
  units: number;
  revenue: number;
  /** Share of sold units whose cost is fully known (0..1). Cost-less units are never counted as free. */
  coverage: number;
  /** Food cost of the costed units only; null when none could be costed. */
  cost: number | null;
  /** Revenue minus cost, over the costed units only. Null when nothing was costed. */
  margin: number | null;
  /** `margin` as a share of the costed units' revenue (0..1). */
  marginPct: number | null;
  /** What the base recipe costs at the latest purchase prices; null when there is no recipe or an ingredient has no price. */
  recipeCost: number | null;
  /** Visible reviews, all-time (not limited to the date range). */
  ratingCount: number;
  avgRating: number | null;
  /** Share (0..1) who would order again; null below the minimum review count. */
  recommendRate: number | null;
}

export interface IDishMargins {
  from: Date;
  to: Date;
  rows: IDishMargin[];
}
