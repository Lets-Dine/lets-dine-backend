import { BillingInterval } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { ANNUAL_MONTHS_CHARGED } from "../constants";
import { IInvoiceLine, IPlan } from "../interfaces/billing.interface";
import { addInterval } from "./billing-period.util";

interface IBillable {
  interval: BillingInterval;
  extraBranches: number;
  extraSeats: number;
}

const priceFor = (monthly: number, interval: BillingInterval): number =>
  interval === "ANNUAL" ? monthly * ANNUAL_MONTHS_CHARGED : monthly;

const line = (description: string, quantity: number, unitAmount: number): IInvoiceLine => ({
  description,
  quantity,
  unitAmount,
  amount: quantity * unitAmount,
});

/**
 * What one period of this plan costs: the plan fee plus any purchased extras.
 * An extra on a plan with no price for it is left off rather than billed at an
 * invented price — assigning one is rejected up front, so that only happens to
 * data that predates the check.
 */
export function buildInvoiceLines(plan: IPlan, subscription: IBillable): IInvoiceLine[] {
  const annual = subscription.interval === "ANNUAL";
  const lines = [line(`${plan.name} plan — ${annual ? "annual" : "monthly"}`, 1, annual ? plan.annualPrice : plan.monthlyPrice)];

  if (subscription.extraBranches > 0 && plan.extraBranchPrice !== null) {
    lines.push(line("Extra branch", subscription.extraBranches, priceFor(plan.extraBranchPrice, subscription.interval)));
  }
  if (subscription.extraSeats > 0 && plan.extraSeatPrice !== null) {
    lines.push(line("Extra staff seat", subscription.extraSeats, priceFor(plan.extraSeatPrice, subscription.interval)));
  }

  return lines;
}

export const sumLines = (lines: IInvoiceLine[]): number => lines.reduce((total, current) => total + current.amount, 0);

/**
 * The next period starts when the current one ends — or now, if it already
 * lapsed, so a late payer is never billed for time that has passed. The invoice
 * is due the day that period starts.
 */
export function resolveInvoicePeriod(
  currentPeriodEnd: Date,
  interval: BillingInterval,
  now: Date
): { periodStart: Date; periodEnd: Date; dueAt: Date } {
  const periodStart = currentPeriodEnd > now ? currentPeriodEnd : now;
  return { periodStart, periodEnd: addInterval(periodStart, interval), dueAt: periodStart };
}

const datePart = (date: Date): string => date.toISOString().slice(0, 10).replaceAll("-", "");

/** Random suffix rather than a counter: a voided invoice's number is never reused, and two generations can't race for the same one. */
export function buildInvoiceNumber(periodStart: Date): string {
  return `INV-${datePart(periodStart)}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
