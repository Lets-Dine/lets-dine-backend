import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { addInterval } from "./billing-period.util";

export interface IPaymentTarget {
  interval: BillingInterval;
  currentPeriodStart: Date;
  pendingPlanId: string | null;
}

export interface IPaidInvoice {
  periodStart: Date;
  periodEnd: Date;
}

export interface ISubscriptionAfterPayment {
  status: SubscriptionStatus;
  trialEndsAt: null;
  pastDueSince: null;
  cancelledAt: null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  /** Set only when a queued downgrade takes effect with this payment. */
  planId?: string;
  pendingPlanId: null;
}

/**
 * What paying an invoice does to its subscription — always back to ACTIVE, with
 * the paid window extended to cover the invoice.
 *
 * - On time or early: the window runs to the invoice's end. Paid early, it keeps its
 *   own start so the window stays continuous.
 * - Paid after the period it covered had already ended: the period starts now, so
 *   the payment never lands the subscription straight back in PAST_DUE.
 * - A queued downgrade takes effect with the payment, since that invoice was priced on it.
 */
export function applyInvoicePayment(subscription: IPaymentTarget, invoice: IPaidInvoice, now: Date): ISubscriptionAfterPayment {
  let currentPeriodStart = invoice.periodStart;
  let currentPeriodEnd = invoice.periodEnd;

  if (invoice.periodEnd <= now) {
    currentPeriodStart = now;
    currentPeriodEnd = addInterval(now, subscription.interval);
  } else if (invoice.periodStart > now) {
    currentPeriodStart = subscription.currentPeriodStart;
  }

  return {
    status: "ACTIVE",
    trialEndsAt: null,
    pastDueSince: null,
    cancelledAt: null,
    currentPeriodStart,
    currentPeriodEnd,
    ...(subscription.pendingPlanId && { planId: subscription.pendingPlanId }),
    pendingPlanId: null,
  };
}
