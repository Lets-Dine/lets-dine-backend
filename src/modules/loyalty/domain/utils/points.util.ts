/**
 * Whole points a bill earns: the subtotal (before service charge and tax) less the cashier's own discount,
 * over the restaurant's spend-per-point, rounded down. Callers leave out the part of a discount that redeemed
 * points paid for: spending points is not spending less, so it must not cost the diner the points the meal earns.
 */
export function pointsFor(subtotal: number, discount: number, spendPerPoint: number): number {
  if (spendPerPoint <= 0) return 0;
  return Math.floor(Math.max(subtotal - discount, 0) / spendPerPoint);
}

/**
 * The most points a bill can take: the customer's balance, or what the cap allows if that is less.
 * The cap is a share of the discounted subtotal, so points never pay for service charge and tax.
 */
export function maxRedeemablePoints(discountableBase: number, balance: number, redeemValue: number, maxRedeemPct: number): number {
  if (redeemValue <= 0) return 0;
  const cap = Math.floor((Math.max(discountableBase, 0) * maxRedeemPct) / 100);
  return Math.max(Math.min(balance, Math.floor(cap / redeemValue)), 0);
}
