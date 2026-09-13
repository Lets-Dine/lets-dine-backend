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
  total: number;
}

/**
 * §37/§41 — totals are always recomputed here from server-side prices and the
 * restaurant's own fee configuration. A client-sent total is never used.
 */
export function calculateOrderTotals(
  lines: { unitPrice: number; quantity: number }[],
  fees: { serviceChargeRate: number; taxRate: number },
  discount = 0
): IOrderTotals {
  const subtotal = sumLines(lines);
  const serviceCharge = percentOf(subtotal, fees.serviceChargeRate);
  const tax = percentOf(subtotal + serviceCharge, fees.taxRate);

  return {
    subtotal,
    serviceCharge,
    tax,
    discount,
    total: subtotal + serviceCharge + tax - discount,
  };
}
