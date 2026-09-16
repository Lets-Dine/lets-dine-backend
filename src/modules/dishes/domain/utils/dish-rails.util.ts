import { MERCH } from "../constants/merchandising";
import { DishRailKey, IDishRail } from "../interfaces/dish-rail.interface";
import { IDishWithStats } from "../interfaces/dish-with-stats.interface";
import { buildRankContext, confidenceScore, IRankContext, rankScore, valueScore, velocityRatio } from "./dish-ranking.util";

/**
 * §24/§49 — the merchandising rails the menu leads with. Each one is a claim
 * about a dish, so qualifying is about evidence (enough ratings, enough orders)
 * and the ordering inside a rail is about whatever that particular claim means:
 * "loved" ranks on the overall score, "trending" on how fast it is climbing,
 * "hidden gem" on confidence-adjusted rating, "best value" on rating per rupee.
 */

interface RailDefinition {
  key: DishRailKey;
  title: string;
  subtitle: string;
  emoji: string;
  limit: number;
  qualifies: (dish: IDishWithStats) => boolean;
  compare: (a: IDishWithStats, b: IDishWithStats, context: IRankContext) => number;
}

const RAILS: RailDefinition[] = [
  {
    key: "loved",
    title: "Most loved here",
    subtitle: "Highest rated by diners who actually ordered them",
    emoji: "🔥",
    limit: MERCH.loved.limit,
    qualifies: dish => dish.stats.ratingCount >= MERCH.loved.minRatings && (dish.stats.avgRating ?? 0) >= MERCH.loved.minRating,
    compare: (a, b, context) => rankScore(b, context) - rankScore(a, context),
  },
  {
    key: "trending",
    title: "Trending today",
    subtitle: "Ordered a lot more than usual this week",
    emoji: "📈",
    limit: MERCH.trending.limit,
    qualifies: dish => velocityRatio(dish.stats) >= MERCH.trending.minVelocityRatio && dish.stats.orders30d >= MERCH.trending.minOrders30d,
    compare: (a, b) => velocityRatio(b.stats) - velocityRatio(a.stats),
  },
  {
    key: "gem",
    title: "Hidden gems",
    subtitle: "Loved by the few who tried them",
    emoji: "💎",
    limit: MERCH.hiddenGem.limit,
    qualifies: dish =>
      (dish.stats.avgRating ?? 0) >= MERCH.hiddenGem.minRating &&
      dish.stats.ratingCount >= MERCH.hiddenGem.minRatings &&
      dish.stats.orders30d <= MERCH.hiddenGem.maxOrders30d,
    compare: (a, b, context) => confidenceScore(b.stats, context.restaurantMean) - confidenceScore(a.stats, context.restaurantMean),
  },
  {
    key: "value",
    title: "Best value",
    subtitle: "Great ratings for the price",
    emoji: "🪙",
    limit: MERCH.goodValue.limit,
    qualifies: dish => dish.stats.ratingCount >= MERCH.goodValue.minRatings && (dish.stats.avgRating ?? 0) >= MERCH.goodValue.minRating,
    compare: (a, b, context) => valueScore(b, context) - valueScore(a, context),
  },
];

export const DISH_RAIL_KEYS: DishRailKey[] = RAILS.map(rail => rail.key);

export interface BuildDishRailsOptions {
  /** Which rails to build, in the order asked for. Defaults to all of them. */
  sections?: DishRailKey[];
  /** Overrides each rail's own cap. */
  limit?: number;
}

export function buildDishRails(dishes: IDishWithStats[], options: BuildDishRailsOptions = {}): IDishRail[] {
  // Recommending something the kitchen has just run out of is worse than
  // recommending nothing, so an unavailable dish never makes a rail.
  const orderable = dishes.filter(dish => dish.isAvailable && !dish.isArchived);
  const context = buildRankContext(orderable);

  const wanted = options.sections?.length ? options.sections : DISH_RAIL_KEYS;

  return (
    wanted
      .map(key => RAILS.find(rail => rail.key === key))
      .filter((rail): rail is RailDefinition => Boolean(rail))
      .map(rail => ({
        key: rail.key,
        title: rail.title,
        subtitle: rail.subtitle,
        emoji: rail.emoji,
        dishes: orderable
          .filter(rail.qualifies)
          .sort((a, b) => rail.compare(a, b, context))
          .slice(0, options.limit ?? rail.limit),
      }))
      // An empty rail is a claim with nothing behind it — leave it out entirely.
      .filter(rail => rail.dishes.length > 0)
  );
}
