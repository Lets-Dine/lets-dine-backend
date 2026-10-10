import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { applyInvoicePayment } from "../../domain/utils/invoice-payment.util";
import { EsewaCheckoutService, IEsewaCheckout } from "../esewa-checkout.service";
import { InvoiceSettlementService } from "../invoice-settlement.service";
import { isRenewalDue, RenewalChargeService } from "../renewal-charge.service";
import { ISubscriptionDetail } from "../../domain/interfaces/billing.interface";

export interface IRenewResult {
  /** Nothing was owed, so the period was extended without a payment. */
  settled: boolean;
  /** Set when the owner should be sent to eSewa. */
  checkout: IEsewaCheckout | null;
}

/**
 * The owner renewing their own plan. The charge is created at this moment
 * (or reused, if a renewal is already open) and paid the same way as before.
 */
@Injectable()
export class RenewSubscriptionUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly renewalChargeService: RenewalChargeService,
    private readonly invoiceSettlementService: InvoiceSettlementService,
    private readonly esewaCheckoutService: EsewaCheckoutService
  ) {}

  async execute(authEntity: AuthEntity, now: Date = new Date()): Promise<IRenewResult> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(authEntity.restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    if (subscription.status === "CANCELLED") throw new BadRequestException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_CANCELLED);

    const open = await this.renewalChargeService.findOpenRenewal(subscription.restaurantId);
    if (!open && !isRenewalDue(subscription.currentPeriodEnd, now)) {
      throw new BadRequestException(BILLING_ERROR_MESSAGES.RENEWAL_NOT_DUE);
    }

    const quoted = await this.renewalChargeService.quote(subscription, now);
    if (!open && quoted.amount === 0) {
      await this.extendWithoutCharge(subscription, quoted.period, now);
      return { settled: true, checkout: null };
    }

    const invoice = await this.renewalChargeService.ensureOpen(subscription, now);
    if (invoice.amount === 0) {
      await this.invoiceSettlementService.settle(invoice.id, { paymentMethod: "none" }, now);
      return { settled: true, checkout: null };
    }
    if (invoice.currency !== "NPR") throw new BadRequestException(BILLING_ERROR_MESSAGES.ESEWA_NPR_ONLY);

    const checkout = await this.esewaCheckoutService.start(invoice.id, authEntity.restaurantId, now);
    return { settled: false, checkout };
  }

  private async extendWithoutCharge(
    subscription: ISubscriptionDetail,
    period: { periodStart: Date; periodEnd: Date },
    now: Date
  ): Promise<void> {
    const update = applyInvoicePayment(subscription, period, now);
    await this.subscriptionRepository.$transaction(async tx => {
      await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
      await this.subscriptionRepository.update(subscription.id, update, { tx });
    });
  }
}
