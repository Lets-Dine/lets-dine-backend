import { MERCH, RANK_WEIGHTS } from "../constants/merchandising";
import { IDish } from "../interfaces/dish.interface";
import { IDishStats } from "../interfaces/dish-stats.interface";
import { DishBadge } from "../interfaces/dish-with-stats.interface";

/**
 * §48 — five stars from two people is not better than 4.6 from three hundred.
 * The prior pulls thin evidence back towards the middle instead of letting it
 * top the menu.
 */
export function bayesianRating(stats: IDishStats): number {
  const { confidenceWeight, priorRating } = MERCH;
  const total = stats.ratingCount + confidenceWeight;
  return ((stats.avgRating ?? priorRating) * stats.ratingCount + priorRating * confidenceWeight) / total;
}

/** How much more (or less) the dish is selling than in the previous window. */
export function velocityRatio(stats: IDishStats): number {
  if (stats.ordersPrev30d === 0) return stats.orders30d > 0 ? Number.POSITIVE_INFINITY : 1;
  return stats.orders30d / stats.ordersPrev30d;
}

/** §49 — one score per dish, in 0..1, for "what should be near the top". */
export function rankScore(stats: IDishStats, maxOrders30d: number): number {
  const rating = bayesianRating(stats) / 5;
  const popularity = maxOrders30d > 0 ? stats.orders30d / maxOrders30d : 0;
  const recommendation = stats.ratingCount >= MERCH.minRatingsForRecommendRate ? (stats.recommendRate ?? 0) : 0;
  const ratio = velocityRatio(stats);
  const trend = Number.isFinite(ratio) ? Math.min(1, Math.max(0, (ratio - 1) / 1)) : 1;

  return (
    rating * RANK_WEIGHTS.rating +
    popularity * RANK_WEIGHTS.popularity +
    recommendation * RANK_WEIGHTS.recommendation +
    trend * RANK_WEIGHTS.trend
  );
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
