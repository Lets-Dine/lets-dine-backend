import { BillingInterval } from "@prisma/client";

const daysInUtcMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * One billing interval after `from`, in UTC. Day-of-month is clamped rather than
 * rolled over, so Jan 31 + 1 month is Feb 28/29, not early March.
 */
export function addInterval(from: Date, interval: BillingInterval): Date {
  const months = interval === "ANNUAL" ? 12 : 1;
  const targetMonthIndex = from.getUTCMonth() + months;
  const year = from.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = targetMonthIndex % 12;
  const day = Math.min(from.getUTCDate(), daysInUtcMonth(year, month));

  return new Date(Date.UTC(year, month, day, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}
