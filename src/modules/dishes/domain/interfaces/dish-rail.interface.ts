import { IDishWithStats } from "./dish-with-stats.interface";

export type DishRailKey = "loved" | "trending" | "gem" | "value";

/**
 * §24 — a merchandising rail on the menu: a claim ("Most loved here") and the
 * dishes that have earned the right to sit under it.
 */
export interface IDishRail {
  key: DishRailKey;
  title: string;
  subtitle: string;
  emoji: string;
  dishes: IDishWithStats[];
}
