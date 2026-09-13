export interface IDishReview {
  id: string;
  restaurantId: string;
  dishId: string;
  orderId: string;
  sessionId: string;
  overall: number;
  taste: number;
  portion: number;
  value: number;
  wouldOrderAgain: boolean;
  comment: string;
  isHidden: boolean;
  /** §9 — from the fixed vocabulary, so they stay countable. */
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  /** Every review here is tied to a completed order — §10 leaves no other path. */
  verified: true;
}
