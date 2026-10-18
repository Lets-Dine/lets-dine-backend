import { MERCH } from "../dishes/domain/constants/merchandising";
import { IDishMargin } from "./dish-margins.interface";

/** What the SQL hands back per dish: sums over every sold unit, and over the subset that could be costed. */
export interface MarginRow {
  dishId: string;
  name: string;
  price: number;
  units: number;
  revenue: number;
  costedUnits: number;
  costedRevenue: number;
  cost: number | null;
  recipeCost: number | null;
  ratingCount: number;
  avgRating: number | null;
  againCount: number | null;
}

/** Margin only over what was costed, so a dish with no recipe reads "unknown" — never a 100% margin. */
export function shapeMargin(r: MarginRow): IDishMargin {
  const costed = r.costedUnits > 0 && r.cost !== null;
  const cost = costed ? Math.round(r.cost as number) : null;
  const margin = cost === null ? null : r.costedRevenue - cost;
  return {
    dishId: r.dishId,
    name: r.name,
    price: r.price,
    units: r.units,
    revenue: r.revenue,
    coverage: r.units > 0 ? r.costedUnits / r.units : 0,
    cost,
    margin,
    marginPct: margin === null || r.costedRevenue <= 0 ? null : margin / r.costedRevenue,
    recipeCost: r.recipeCost === null ? null : Math.round(r.recipeCost),
    ratingCount: r.ratingCount,
    avgRating: r.avgRating,
    recommendRate: r.ratingCount >= MERCH.minRatingsForRecommendRate ? (r.againCount ?? 0) / r.ratingCount : null,
  };
}
