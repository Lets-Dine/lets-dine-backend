import { Injectable } from "@nestjs/common";
import { INVOICE_LEAD_DAYS } from "../../domain/constants";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { applyInvoicePayment } from "../../domain/utils/invoice-payment.util";
import { RenewalChargeService } from "../renewal-charge.service";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IRollComplimentaryResult {
  /** Plans that cost nothing and were extended. Paid plans are left for the restaurant to renew. */
  rolled: number;
}

/**
 * Extends every due subscription that owes nothing, before the lifecycle sweep
 * can mark it overdue for a payment that was never owed. A paid plan is not
 * billed here — the restaurant is reminded, and the charge is created when they renew.
 */
@Injectable()
export class RollComplimentaryPeriodsUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly renewalChargeService: RenewalChargeService
  ) {}

  async execute(now: Date = new Date(), leadDays = INVOICE_LEAD_DAYS): Promise<IRollComplimentaryResult> {
    const due = await this.subscriptionRepository.findDueForInvoicing(new Date(now.getTime() + leadDays * DAY_MS));
    let rolled = 0;

    for (const subscription of due) {
      const quoted = await this.renewalChargeService.quote(subscription, now);
      if (quoted.amount !== 0) continue;

      const update = applyInvoicePayment(subscription, quoted.period, now);
      await this.subscriptionRepository.$transaction(async tx => {
        await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
        await this.subscriptionRepository.update(subscription.id, update, { tx });
      });
      rolled += 1;
    }

    return { rolled };
  }
}
