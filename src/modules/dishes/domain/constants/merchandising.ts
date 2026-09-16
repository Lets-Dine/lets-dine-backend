/**
 * §12/§48/§49. The thresholds behind every badge and every ranking decision,
 * kept in one place so changing what "trending" means never means touching a
 * use case. These mirror the diner app's own merchandising rules.
 */
export const MERCH = {
  /** Bayesian prior strength — how many "average" votes a dish starts with. */
  confidenceWeight: 12,
  /** Below this many ratings we show a rating but never rank on it. */
  minRatingsToRank: 5,
  /** Below this we do not claim a recommendation rate at all. */
  minRatingsForRecommendRate: 5,
  /** The prior itself: the rating an unrated dish is assumed to sit at. */
  priorRating: 4,

  loved: { minRating: 4.4, minRatings: 20, limit: 6 },
  popular: { minOrders30d: 140 },
  trending: { minVelocityRatio: 1.35, minOrders30d: 40, limit: 6 },
  hiddenGem: { minRating: 4.5, minRatings: 8, maxOrders30d: 70, limit: 4 },
  goodValue: { minRating: 4.2, minRatings: 8, limit: 4 },
} as const;

/** §49 — how the MVP weighs a dish. Deliberately replaceable. */
export const RANK_WEIGHTS = {
  rating: 0.5,
  popularity: 0.25,
  recommendation: 0.15,
  trend: 0.1,
} as const;

export const TOP_TAGS_LIMIT = 4;
