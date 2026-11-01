import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { addInterval } from "../../domain/utils/billing-period.util";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { ReactivateSubscriptionInput } from "../../interfaces/http/validations/subscription-edit.validation";

/** Brings a cancelled subscription back on a fresh paid period, or just withdraws a cancellation that has not happened yet. */
@Injectable()
export class ReactivateSubscriptionUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository
  ) {}

  async execute(restaurantId: string, dto: ReactivateSubscriptionInput): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);

    const cancelled = subscription.status === "CANCELLED";
    if (!cancelled && !subscription.cancelAtPeriodEnd) throw new BadRequestException(BILLING_ERROR_MESSAGES.NOT_CANCELLED);

    const now = new Date();
    await this.subscriptionRepository.$transaction(async tx => {
      await this.subscriptionRepository.update(
        subscription.id,
        cancelled
          ? {
              status: "ACTIVE",
              cancelledAt: null,
              cancelAtPeriodEnd: false,
              pastDueSince: null,
              trialEndsAt: null,
              currentPeriodStart: now,
              currentPeriodEnd: addInterval(now, subscription.interval),
            }
          : { cancelAtPeriodEnd: false },
        { tx }
      );
      await this.subscriptionRepository.addChange(
        subscription.id,
        {
          action: "reactivated",
          reason: dto.reason,
          detail: cancelled ? "Reactivated on a new period" : "Scheduled cancellation withdrawn",
        },
        { tx }
      );
      // The old period's charge no longer matches the new one.
      if (cancelled) await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
    });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return toSubscriptionView(updated as NonNullable<typeof updated>);
  }
}
