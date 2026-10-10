import { Injectable } from "@nestjs/common";
import { INVOICE_LEAD_DAYS } from "../domain/constants";
import { IInvoice, IInvoiceLine, ISubscriptionDetail } from "../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../domain/repositories/invoice.repository";
import { UsageRepository } from "../domain/repositories/usage.repository";
import { buildInvoiceLines, buildInvoiceNumber, resolveInvoicePeriod, sumLines } from "../domain/utils/invoice-builder.util";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True once the paid window ends within the lead, or has already ended. Same moment a renewal invoice used to be issued. */
export const isRenewalDue = (currentPeriodEnd: Date, now: Date, leadDays = INVOICE_LEAD_DAYS): boolean =>
  currentPeriodEnd.getTime() <= now.getTime() + leadDays * DAY_MS;

export interface IRenewalQuote {
  lines: IInvoiceLine[];
  amount: number;
  currency: string;
  period: { periodStart: Date; periodEnd: Date; dueAt: Date };
}

/**
 * The renewal charge eSewa and a team-recorded payment settle. It is created when
 * someone actually pays, not mailed out ahead of the period ending.
 */
@Injectable()
export class RenewalChargeService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly usageRepository: UsageRepository
  ) {}

  async quote(subscription: ISubscriptionDetail, now: Date): Promise<IRenewalQuote> {
    const plan = subscription.pendingPlan ?? subscription.plan;
    const [usedBranches, usedSeats] = await Promise.all([
      this.usageRepository.countActiveBranches(subscription.restaurantId),
      this.usageRepository.countActiveSeats(subscription.restaurantId),
    ]);
    const lines = buildInvoiceLines(plan, { ...subscription, usedBranches, usedSeats });
    return {
      lines,
      amount: sumLines(lines),
      currency: plan.currency,
      period: resolveInvoicePeriod(subscription.currentPeriodEnd, subscription.interval, now),
    };
  }

  async findOpenRenewal(restaurantId: string): Promise<IInvoice | null> {
    const open = await this.invoiceRepository.fetchAll({ restaurantId, status: "OPEN" }, { limit: 20, returnCount: false });
    return open.rows.find(row => row.kind === "RENEWAL") ?? null;
  }

  /** Reuses an open renewal so a second attempt cannot bill the same period twice. */
  async ensureOpen(subscription: ISubscriptionDetail, now: Date): Promise<IInvoice> {
    const existing = await this.findOpenRenewal(subscription.restaurantId);
    if (existing) return existing;

    const quoted = await this.quote(subscription, now);
    return this.invoiceRepository.create({
      subscriptionId: subscription.id,
      restaurantId: subscription.restaurantId,
      number: buildInvoiceNumber(quoted.period.periodStart),
      lines: quoted.lines,
      amount: quoted.amount,
      currency: quoted.currency,
      ...quoted.period,
      kind: "RENEWAL",
    });
  }
}
