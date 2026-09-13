import { IDish } from "./dish.interface";
import { IDishStats } from "./dish-stats.interface";

export type DishBadge = "popular" | "loved" | "trending" | "gem" | "value" | "pick";

export interface IDishWithStats extends IDish {
  stats: IDishStats;
  /** §49 — what this dish has earned the right to be called, computed server-side. */
  badges: DishBadge[];
}
