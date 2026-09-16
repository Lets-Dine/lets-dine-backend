import { MERCH, RANK_WEIGHTS } from "../constants/merchandising";
import { IDish } from "../interfaces/dish.interface";
import { IDishStats } from "../interfaces/dish-stats.interface";
import { DishBadge } from "../interfaces/dish-with-stats.interface";

/**
 * Ranking is always relative to the menu it happens on: the same 4.6 means
 * something different at a restaurant that averages 4.7 than at one that
 * averages 3.9, and "busy" only means anything next to the busiest dish.
 */
export interface IRankContext {
  restaurantMean: number;
  maxOrders30d: number;
  maxPrice: number;
}

export function buildRankContext(dishes: { price: number; stats: IDishStats }[]): IRankContext {
  const rated = dishes.filter(dish => dish.stats.avgRating !== null && dish.stats.ratingCount > 0);
  const totalRatings = rated.reduce((count, dish) => count + dish.stats.ratingCount, 0);

  return {
    restaurantMean:
      totalRatings > 0
        ? rated.reduce((sum, dish) => sum + (dish.stats.avgRating ?? 0) * dish.stats.ratingCount, 0) / totalRatings
        : MERCH.priorRating,
    maxOrders30d: Math.max(0, ...dishes.map(dish => dish.stats.orders30d)),
    maxPrice: Math.max(1, ...dishes.map(dish => dish.price)),
  };
}

/**
 * §48 — five stars from two people is not better than 4.6 from three hundred.
 * The restaurant's own mean is the prior, so thin evidence is pulled back
 * towards what this kitchen usually scores rather than an invented constant.
 */
export function confidenceScore(stats: IDishStats, restaurantMean: number): number {
  if (stats.avgRating === null || stats.ratingCount === 0) return restaurantMean * 0.9;

  const weight = MERCH.confidenceWeight;
  return (restaurantMean * weight + stats.avgRating * stats.ratingCount) / (weight + stats.ratingCount);
}

/**
 * How much more (or less) the dish is selling than in the previous window. A
 * dish with no previous window counts as doubled rather than infinite — the
 * number ends up in a JSON response, and `Infinity` does not survive that.
 */
export function velocityRatio(stats: IDishStats): number {
  if (stats.ordersPrev30d === 0) return stats.orders30d > 0 ? 2 : 1;
  return stats.orders30d / stats.ordersPrev30d;
}

/** 0..1 popularity, normalised against the busiest dish on the menu. */
function normalisedPopularity(stats: IDishStats, maxOrders30d: number): number {
  if (maxOrders30d <= 0) return 0;
  return Math.min(1, stats.orders30d / maxOrders30d);
}

/** §49 — one score per dish, for "what should be near the top". */
export function rankScore(dish: { stats: IDishStats }, context: IRankContext): number {
  const stats = dish.stats;
  const rating = confidenceScore(stats, context.restaurantMean) / 5;
  const popularity = normalisedPopularity(stats, context.maxOrders30d);
  const recommendation = stats.recommendRate ?? 0.5;
  const trend = Math.min(1, Math.max(0, (velocityRatio(stats) - 0.8) / 1.2));

  return (
    rating * RANK_WEIGHTS.rating +
    popularity * RANK_WEIGHTS.popularity +
    recommendation * RANK_WEIGHTS.recommendation +
    trend * RANK_WEIGHTS.trend
  );
}

/** Confidence-adjusted rating per rupee, normalised across the menu. */
export function valueScore(dish: { price: number; stats: IDishStats }, context: IRankContext): number {
  return confidenceScore(dish.stats, context.restaurantMean) / (dish.price / context.maxPrice);
}

/**
 * §7 — a badge is a claim, so each one has to be earned by evidence rather than
 * by being the best of a thin field.
 */
export function dishBadges(dish: IDish, stats: IDishStats): DishBadge[] {
  const badges: DishBadge[] = [];
  const rating = stats.avgRating ?? 0;

  if (dish.isFeatured) badges.push("pick");
  if (stats.orders30d >= MERCH.popular.minOrders30d) badges.push("popular");
  if (rating >= MERCH.loved.minRating && stats.ratingCount >= MERCH.loved.minRatings) badges.push("loved");
  if (stats.orders30d >= MERCH.trending.minOrders30d && velocityRatio(stats) >= MERCH.trending.minVelocityRatio) {
    badges.push("trending");
  }
  if (
    rating >= MERCH.hiddenGem.minRating &&
    stats.ratingCount >= MERCH.hiddenGem.minRatings &&
    stats.orders30d <= MERCH.hiddenGem.maxOrders30d
  ) {
    badges.push("gem");
  }
  if (rating >= MERCH.goodValue.minRating && stats.ratingCount >= MERCH.goodValue.minRatings && (stats.value ?? 0) >= 4.3) {
    badges.push("value");
  }

  return badges;
}
