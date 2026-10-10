/** A review reached through the order line that used a lot. */
export interface IReviewSample {
  lotId: string;
  ingredientId: string;
  /** Taste or overall at two stars or below. */
  poor: boolean;
}

export interface ILotScore {
  lotId: string;
  ingredientId: string;
  reviewCount: number;
  poorCount: number;
  poorRate: number;
  /** The poor-review rate across every lot of the same ingredient — what "normal" looks like for it. */
  baselineRate: number;
  flagged: boolean;
}

/** Fewer reviews than this and a bad streak is just noise. */
export const MIN_REVIEWS = 4;
export const MIN_POOR = 2;
/** A lot is flagged when it is this many times worse than the ingredient's other lots. */
export const WORSE_BY = 2;

/**
 * Scores each lot's reviews against the rest of the same ingredient. A dish has several
 * ingredients, so one bad review lands on all of them; comparing a lot with its own ingredient's
 * baseline is what separates "this chicken" from "this dish is just unpopular".
 */
export function scoreLots(samples: IReviewSample[]): ILotScore[] {
  const lots = new Map<string, { ingredientId: string; reviewCount: number; poorCount: number }>();
  const ingredients = new Map<string, { reviewCount: number; poorCount: number }>();

  for (const sample of samples) {
    const lot = lots.get(sample.lotId) ?? { ingredientId: sample.ingredientId, reviewCount: 0, poorCount: 0 };
    const total = ingredients.get(sample.ingredientId) ?? { reviewCount: 0, poorCount: 0 };
    lot.reviewCount += 1;
    total.reviewCount += 1;
    if (sample.poor) {
      lot.poorCount += 1;
      total.poorCount += 1;
    }
    lots.set(sample.lotId, lot);
    ingredients.set(sample.ingredientId, total);
  }

  return [...lots].map(([lotId, lot]) => {
    const total = ingredients.get(lot.ingredientId)!;
    // The baseline leaves this lot out, otherwise a lot is partly judged against itself.
    const otherReviews = total.reviewCount - lot.reviewCount;
    const baselineRate = otherReviews > 0 ? (total.poorCount - lot.poorCount) / otherReviews : 0;
    const poorRate = lot.poorCount / lot.reviewCount;
    return {
      lotId,
      ingredientId: lot.ingredientId,
      reviewCount: lot.reviewCount,
      poorCount: lot.poorCount,
      poorRate,
      baselineRate,
      flagged: lot.reviewCount >= MIN_REVIEWS && lot.poorCount >= MIN_POOR && poorRate >= baselineRate * WORSE_BY,
    };
  });
}
