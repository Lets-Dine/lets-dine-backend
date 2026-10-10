import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { applyInvoicePayment } from "../../domain/utils/invoice-payment.util";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { MarkInvoicePaidInput } from "../../interfaces/http/validations/mark-invoice-paid.validation";
import { InvoiceSettlementService } from "../invoice-settlement.service";
import { RenewalChargeService } from "../renewal-charge.service";

/**
 * An operator recording that a renewal was paid. If no renewal charge is open yet,
 * one is created and settled in the same step — nothing is left waiting to be paid.
 * A plan that costs nothing is extended with no charge at all.
 */
@Injectable()
export class RecordRenewalPaymentUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly renewalChargeService: RenewalChargeService,
    private readonly invoiceSettlementService: InvoiceSettlementService
  ) {}

  async execute(restaurantId: string, dto: MarkInvoicePaidInput, now: Date = new Date()): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    if (subscription.status === "CANCELLED") throw new BadRequestException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_CANCELLED);

    const open = await this.renewalChargeService.findOpenRenewal(restaurantId);
    const quoted = await this.renewalChargeService.quote(subscription, now);

    if (!open && quoted.amount === 0) {
      const update = applyInvoicePayment(subscription, quoted.period, now);
      await this.subscriptionRepository.$transaction(async tx => {
        await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
        await this.subscriptionRepository.update(subscription.id, update, { tx });
      });
    } else {
      const invoice = open ?? (await this.renewalChargeService.ensureOpen(subscription, now));
      const payment = invoice.amount === 0 ? { paymentMethod: "none" } : { paymentMethod: dto.paymentMethod, paymentRef: dto.paymentRef };
      await this.invoiceSettlementService.settle(invoice.id, payment, now);
    }

    const updated = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    return toSubscriptionView(updated as NonNullable<typeof updated>);
  }
}
