import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES, INVOICE_LEAD_DAYS } from "../../domain/constants";
import { IInvoice, ISubscriptionDetail } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { UsageRepository } from "../../domain/repositories/usage.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { buildInvoiceLines, buildInvoiceNumber, resolveInvoicePeriod, sumLines } from "../../domain/utils/invoice-builder.util";
import { GenerateInvoicesInput } from "../../interfaces/http/validations/generate-invoices.validation";
import { InvoiceSettlementService } from "../invoice-settlement.service";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IGenerateInvoicesResult {
  generated: IInvoice[];
  /** Of those, how many cost nothing and so renewed the subscription straight away. */
  autoSettled: number;
}

/**
 * Issues the renewal invoice for every subscription whose paid window ends within
 * the lead time and that has none open. Safe to run repeatedly — a subscription with
 * an open invoice is skipped, so nothing is ever invoiced twice. Run by an admin
 * today; a scheduler can call it unchanged.
 */
@Injectable()
export class GenerateInvoicesUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly usageRepository: UsageRepository,
    private readonly invoiceSettlementService: InvoiceSettlementService
  ) {}

  async execute(dto: GenerateInvoicesInput = {}, now: Date = new Date()): Promise<IGenerateInvoicesResult> {
    const leadDays = dto.leadDays ?? INVOICE_LEAD_DAYS;
    const due = await this.subscriptionRepository.findDueForInvoicing(new Date(now.getTime() + leadDays * DAY_MS));

    const generated: IInvoice[] = [];
    let autoSettled = 0;

    for (const subscription of due) {
      const invoice = await this.issue(subscription, now);
      if (invoice.amount === 0) autoSettled += 1;
      generated.push(invoice);
    }

    return { generated, autoSettled };
  }

  /**
   * Issues the next invoice for one restaurant now, whatever the lead window says — for an
   * operator settling a restaurant ahead of schedule. Refuses rather than double-invoice.
   */
  async executeForRestaurant(restaurantId: string, now: Date = new Date()): Promise<IInvoice> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    if (subscription.status === "CANCELLED") throw new BadRequestException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_CANCELLED);

    const open = await this.invoiceRepository.fetchAll({ restaurantId, status: "OPEN" }, { limit: 1, returnCount: false });
    if (open.rows.length > 0) throw new BadRequestException(BILLING_ERROR_MESSAGES.INVOICE_ALREADY_OPEN);

    return this.issue(subscription, now);
  }

  private async issue(subscription: ISubscriptionDetail, now: Date): Promise<IInvoice> {
    // A downgrade queued for the next period is billed at its own price.
    const plan = subscription.pendingPlan ?? subscription.plan;
    const [usedBranches, usedSeats] = await Promise.all([
      this.usageRepository.countActiveBranches(subscription.restaurantId),
      this.usageRepository.countActiveSeats(subscription.restaurantId),
    ]);
    const lines = buildInvoiceLines(plan, { ...subscription, usedBranches, usedSeats });
    const period = resolveInvoicePeriod(subscription.currentPeriodEnd, subscription.interval, now);
    const amount = sumLines(lines);

    const invoice = await this.invoiceRepository.create({
      subscriptionId: subscription.id,
      restaurantId: subscription.restaurantId,
      number: buildInvoiceNumber(period.periodStart),
      lines,
      amount,
      currency: plan.currency,
      ...period,
    });

    // Nothing to collect (a free or custom-priced plan), so there is nothing to wait for either.
    return amount === 0 ? this.invoiceSettlementService.settle(invoice.id, { paymentMethod: "none" }, now) : invoice;
  }
}
