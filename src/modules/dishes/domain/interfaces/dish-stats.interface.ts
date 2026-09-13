export interface IDishTagCount {
  tag: string;
  count: number;
}

/** §12 — the server-computed numbers a dish card and dish detail screen show. */
export interface IDishStats {
  ratingCount: number;
  avgRating: number | null;
  taste: number | null;
  portion: number | null;
  value: number | null;
  /** Would-order-again share, 0..1. Null until there is enough signal (§9). */
  recommendRate: number | null;
  /** Count of 1..5 star reviews, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
  /** Units ordered in the trailing 30 days and in the 30 before that (§12). */
  orders30d: number;
  ordersPrev30d: number;
  topTags: IDishTagCount[];
}

export const EMPTY_DISH_STATS: IDishStats = {
  ratingCount: 0,
  avgRating: null,
  taste: null,
  portion: null,
  value: null,
  recommendRate: null,
  distribution: [0, 0, 0, 0, 0],
  orders30d: 0,
  ordersPrev30d: 0,
  topTags: [],
};
