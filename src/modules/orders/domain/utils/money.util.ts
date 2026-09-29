/**
 * All order arithmetic happens in integer minor units (paisa). §34 bans
 * floating-point money, and rounding only ever happens on a percentage.
 */
export function percentOf(minor: number, rate: number): number {
  return Math.round(minor * rate);
}

export function sumLines(lines: { unitPrice: number; quantity: number }[]): number {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

export interface IOrderTotals {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  /** A flat, untaxed delivery charge — 0 for a dine-in order. */
  deliveryFee: number;
  total: number;
}

/**
 * §37/§41 — totals are always recomputed here from server-side prices and the
 * restaurant's own fee configuration. A client-sent total is never used.
 *
 * The discount comes off the subtotal before service charge and tax are
 * computed, not off the final bill — a discounted dish is charged service
 * and tax on what it actually costs, not on the pre-discount price.
 *
 * `deliveryFee` is a flat charge (§41 — read from `Restaurant.deliveryFeeAmount`
 * by the caller for a delivery order, 0 otherwise) added straight into the
 * total — it is neither discounted nor subject to service charge/tax, unlike
 * the food itself.
 */
export function calculateOrderTotals(
  lines: { unitPrice: number; quantity: number }[],
  fees: { serviceChargeRate: number; taxRate: number },
  discount = 0,
  deliveryFee = 0
): IOrderTotals {
  const subtotal = sumLines(lines);
  const discountedSubtotal = subtotal - discount;
  const serviceCharge = percentOf(discountedSubtotal, fees.serviceChargeRate);
  const tax = percentOf(discountedSubtotal + serviceCharge, fees.taxRate);

  return {
    subtotal,
    serviceCharge,
    tax,
    discount,
    deliveryFee,
    total: discountedSubtotal + serviceCharge + tax + deliveryFee,
  };
}
