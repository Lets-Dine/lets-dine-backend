import { BillingInterval } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { ANNUAL_MONTHS_CHARGED } from "../constants";
import { planLimitsSchema } from "../../interfaces/http/validations/plan-config.validation";
import { IInvoiceLine, IPlan } from "../interfaces/billing.interface";
import { addInterval } from "./billing-period.util";

interface IBillable {
  interval: BillingInterval;
  extraBranches: number;
  extraSeats: number;
  /** Active right now — whatever is beyond what the plan includes is billed, purchased or not. */
  usedBranches: number;
  usedSeats: number;
}

const priceFor = (monthly: number, interval: BillingInterval): number =>
  interval === "ANNUAL" ? monthly * ANNUAL_MONTHS_CHARGED : monthly;

const line = (description: string, quantity: number, unitAmount: number): IInvoiceLine => ({
  description,
  quantity,
  unitAmount,
  amount: quantity * unitAmount,
});

/** Branches or seats billed as extras: the larger of what was purchased and what is actually in use past the plan's own limit. */
const billedExtras = (purchased: number, used: number, included: number | undefined): number =>
  Math.max(purchased, included === undefined ? 0 : used - included);

/**
 * What one period of this plan costs: the plan fee plus extras — purchased, or simply in use past the limit.
 * Nothing is capped; the overage is how the plan grows with the restaurant.
 * ponytail: a snapshot of usage at invoice time, not peak or prorated — add usage history if that gets disputed.
 * An extra on a plan with no price for it is left off rather than billed at an
 * invented price — assigning one is rejected up front, so that only happens to
 * data that predates the check.
 */
export function buildInvoiceLines(plan: IPlan, subscription: IBillable): IInvoiceLine[] {
  const annual = subscription.interval === "ANNUAL";
  const limits = planLimitsSchema.parse(plan.limits);
  const lines = [line(`${plan.name} plan — ${annual ? "annual" : "monthly"}`, 1, annual ? plan.annualPrice : plan.monthlyPrice)];

  const branches = billedExtras(subscription.extraBranches, subscription.usedBranches, limits.branches);
  if (branches > 0 && plan.extraBranchPrice !== null) {
    lines.push(line("Extra branch", branches, priceFor(plan.extraBranchPrice, subscription.interval)));
  }
  const seats = billedExtras(subscription.extraSeats, subscription.usedSeats, limits.staffSeats);
  if (seats > 0 && plan.extraSeatPrice !== null) {
    lines.push(line("Extra staff seat", seats, priceFor(plan.extraSeatPrice, subscription.interval)));
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
