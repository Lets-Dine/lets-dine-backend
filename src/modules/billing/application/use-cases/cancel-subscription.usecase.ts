import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES, SUBSCRIPTION_LOCKED_EVENT } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { CancelSubscriptionInput } from "../../interfaces/http/validations/subscription-edit.validation";

/** Cancels now, or flags it to end with the paid period — the lifecycle sweep then cancels it instead of letting it go past due. */
@Injectable()
export class CancelSubscriptionUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(restaurantId: string, dto: CancelSubscriptionInput): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    if (subscription.status === "CANCELLED") throw new BadRequestException(BILLING_ERROR_MESSAGES.ALREADY_CANCELLED);

    if (dto.when === "PERIOD_END" && subscription.status !== "TRIAL" && subscription.status !== "ACTIVE") {
      throw new BadRequestException(BILLING_ERROR_MESSAGES.CANCEL_AT_END_NOT_AVAILABLE);
    }

    const now = dto.when === "NOW";
    await this.subscriptionRepository.$transaction(async tx => {
      await this.subscriptionRepository.update(
        subscription.id,
        now ? { status: "CANCELLED", cancelledAt: new Date(), cancelAtPeriodEnd: false } : { cancelAtPeriodEnd: true },
        { tx }
      );
      await this.subscriptionRepository.addChange(
        subscription.id,
        { action: "cancelled", reason: dto.reason, detail: now ? "Cancelled now" : "Cancels at period end" },
        { tx }
      );
      if (now) await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
    });

    // Staff already connected to the live order pass would otherwise keep it until they disconnect.
    if (now && subscription.status !== "SUSPENDED") this.eventEmitter.emit(SUBSCRIPTION_LOCKED_EVENT, { restaurantId });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return toSubscriptionView(updated as NonNullable<typeof updated>);
  }
}
