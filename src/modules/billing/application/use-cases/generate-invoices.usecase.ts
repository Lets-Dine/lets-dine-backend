import { Injectable } from "@nestjs/common";
import { INVOICE_LEAD_DAYS } from "../../domain/constants";
import { IInvoice } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
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
    private readonly invoiceSettlementService: InvoiceSettlementService
  ) {}

  async execute(dto: GenerateInvoicesInput = {}, now: Date = new Date()): Promise<IGenerateInvoicesResult> {
    const leadDays = dto.leadDays ?? INVOICE_LEAD_DAYS;
    const due = await this.subscriptionRepository.findDueForInvoicing(new Date(now.getTime() + leadDays * DAY_MS));

    const generated: IInvoice[] = [];
    let autoSettled = 0;

    for (const subscription of due) {
      // A downgrade queued for the next period is billed at its own price.
      const plan = subscription.pendingPlan ?? subscription.plan;
      const lines = buildInvoiceLines(plan, subscription);
      const period = resolveInvoicePeriod(subscription.currentPeriodEnd, subscription.interval, now);
      const amount = sumLines(lines);

      let invoice = await this.invoiceRepository.create({
        subscriptionId: subscription.id,
        restaurantId: subscription.restaurantId,
        number: buildInvoiceNumber(period.periodStart),
        lines,
        amount,
        currency: plan.currency,
        ...period,
      });

      // Nothing to collect (a free or custom-priced plan), so there is nothing to wait for either.
      if (amount === 0) {
        invoice = await this.invoiceSettlementService.settle(invoice.id, { paymentMethod: "none" }, now);
        autoSettled += 1;
      }

      generated.push(invoice);
    }

    return { generated, autoSettled };
  }
}
