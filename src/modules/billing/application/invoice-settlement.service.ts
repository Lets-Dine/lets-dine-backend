import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../domain/constants";
import { IInvoice } from "../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../domain/repositories/subscription.repository";
import { applyInvoicePayment } from "../domain/utils/invoice-payment.util";

export interface ISettlement {
  paymentMethod: string;
  paymentRef?: string | null;
  markedPaidBy?: string | null;
}

/**
 * The single path by which an invoice becomes paid and its subscription is
 * renewed (or, for an upgrade invoice, moved to the new plan). A manual mark-paid today, a gateway webhook or an auto-settled zero
 * invoice later — they all come through here, so renewal rules live in one place.
 */
@Injectable()
export class InvoiceSettlementService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly subscriptionRepository: SubscriptionRepository
  ) {}

  async settle(invoiceId: string, settlement: ISettlement, now: Date = new Date()): Promise<IInvoice> {
    return this.invoiceRepository.$transaction(async tx => {
      const invoice = await this.invoiceRepository.findById(invoiceId, { tx });
      if (!invoice) throw new NotFoundException(BILLING_ERROR_MESSAGES.INVOICE_NOT_FOUND);
      if (invoice.status !== "OPEN") throw new BadRequestException(BILLING_ERROR_MESSAGES.INVOICE_NOT_OPEN);

      const subscription = await this.subscriptionRepository.findDetailById(invoice.subscriptionId, { tx });
      if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);

      const closed = await this.invoiceRepository.markPaidIfOpen(
        invoice.id,
        {
          paidAt: now,
          paymentMethod: settlement.paymentMethod,
          paymentRef: settlement.paymentRef ?? null,
          markedPaidBy: settlement.markedPaidBy ?? null,
        },
        { tx }
      );
      // Somebody else paid it between the read above and the write.
      if (!closed) throw new BadRequestException(BILLING_ERROR_MESSAGES.INVOICE_NOT_OPEN);

      // A second open invoice (two simultaneous generations) is now redundant — the period is paid.
      await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx, exceptId: invoice.id });
      // An upgrade invoice switches the plan; it never touches the paid window, which the renewal invoice covers.
      const update =
        invoice.kind === "UPGRADE" && invoice.upgradePlanId
          ? { planId: invoice.upgradePlanId, pendingPlanId: null }
          : applyInvoicePayment(subscription, invoice, now);
      await this.subscriptionRepository.update(subscription.id, update, { tx });

      const paid = (await this.invoiceRepository.findById(invoice.id, { tx })) as IInvoice;
      // What the restaurant paid us is its expense too; a free invoice has nothing to book.
      if (paid.amount > 0) await this.invoiceRepository.recordAsExpense(paid, { tx });
      return paid;
    });
  }
}
