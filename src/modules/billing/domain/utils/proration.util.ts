import { BillingInterval } from "@prisma/client";

/**
 * What moving up a plan costs for the rest of the period already paid: the price difference
 * scaled by the share of the period left. Zero (or negative) means nothing to collect.
 * ponytail: extras are not re-priced mid-period — they follow the new plan from the next invoice.
 */
export function prorateUpgrade(
  price: { from: number; to: number },
  period: { start: Date; end: Date },
  now: Date
): number {
  const total = period.end.getTime() - period.start.getTime();
  const left = Math.min(Math.max(period.end.getTime() - now.getTime(), 0), total);
  if (total <= 0) return 0;
  return Math.max(Math.round(((price.to - price.from) * left) / total), 0);
}

export const planPriceFor = (plan: { monthlyPrice: number; annualPrice: number }, interval: BillingInterval): number =>
  interval === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
