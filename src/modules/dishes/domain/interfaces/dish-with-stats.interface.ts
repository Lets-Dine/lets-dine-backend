import { IDishVariant } from "../../../dish-variants/domain/interfaces/dish-variant.interface";
import { IDish } from "./dish.interface";
import { IDishStats } from "./dish-stats.interface";

export type DishBadge = "popular" | "loved" | "trending" | "gem" | "value" | "pick";

export interface IDishWithStats extends IDish {
  stats: IDishStats;
  /** §49 — what this dish has earned the right to be called, computed server-side. */
  badges: DishBadge[];
  /** Ids of the add-ons linked to this dish — resolved against the menu's add-on catalog client-side. */
  addOnIds: string[];
  /** Full embedded rows, not ids into a catalog — unlike add-ons, there's nothing to dedup. */
  variants: IDishVariant[];
}
