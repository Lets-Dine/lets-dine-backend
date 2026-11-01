import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { ISubscriptionUpdate, SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { featureOverridesSchema } from "../../interfaces/http/validations/plan-config.validation";
import { AdjustSubscriptionInput } from "../../interfaces/http/validations/subscription-edit.validation";

const day = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Platform-side edits to a subscription's price, dates and features, each
 * logged with the operator's reason. Dates move the paid window, so anything
 * open was priced on the old one and is voided (same as assigning a plan).
 */
@Injectable()
export class AdjustSubscriptionUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository
  ) {}

  async execute(restaurantId: string, dto: AdjustSubscriptionInput): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    if (subscription.status === "CANCELLED") throw new BadRequestException(BILLING_ERROR_MESSAGES.ALREADY_CANCELLED);
    if (dto.trialEndsAt && dto.currentPeriodEnd) throw new BadRequestException(BILLING_ERROR_MESSAGES.BOTH_DATES);
    const newEnd = dto.trialEndsAt ?? dto.currentPeriodEnd;
    if (newEnd && newEnd <= new Date()) throw new BadRequestException(BILLING_ERROR_MESSAGES.DATE_NOT_FUTURE);

    const update: ISubscriptionUpdate = {};
    const details: string[] = [];

    if (dto.discountPercent !== undefined || dto.discountEndsAt !== undefined) {
      const percent = (dto.discountPercent === undefined ? subscription.discountPercent : dto.discountPercent) || null;
      const endsAt = percent === null ? null : dto.discountEndsAt === undefined ? subscription.discountEndsAt : dto.discountEndsAt;
      update.discountPercent = percent;
      update.discountEndsAt = endsAt;
      details.push(percent ? `Discount ${percent}%${endsAt ? ` until ${day(endsAt)}` : ""}` : "Discount removed");
    }

    const discountChanged = details.length > 0;
    let datesMoved = false;
    if (dto.trialEndsAt) {
      if (subscription.status !== "TRIAL") throw new BadRequestException(BILLING_ERROR_MESSAGES.TRIAL_DATE_NOT_ON_TRIAL);
      update.trialEndsAt = dto.trialEndsAt;
      update.currentPeriodEnd = dto.trialEndsAt;
      details.push(`Trial ends ${day(dto.trialEndsAt)}`);
      datesMoved = true;
    } else if (dto.currentPeriodEnd) {
      if (subscription.status === "TRIAL") throw new BadRequestException(BILLING_ERROR_MESSAGES.PERIOD_END_ON_TRIAL);
      if (subscription.status !== "ACTIVE") throw new BadRequestException(BILLING_ERROR_MESSAGES.PERIOD_END_WHEN_UNPAID);
      update.currentPeriodEnd = dto.currentPeriodEnd;
      details.push(`Period ends ${day(dto.currentPeriodEnd)}`);
      datesMoved = true;
    }
    if (update.currentPeriodEnd && update.currentPeriodEnd <= subscription.currentPeriodStart) {
      throw new BadRequestException(BILLING_ERROR_MESSAGES.PERIOD_END_BEFORE_START);
    }

    if (dto.featureOverrides) {
      const merged: Record<string, boolean | string> = { ...featureOverridesSchema.parse(subscription.featureOverrides ?? {}) };
      for (const [key, value] of Object.entries(dto.featureOverrides)) {
        if (value === undefined) continue;
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      update.featureOverrides = Object.keys(merged).length ? merged : null;
      details.push(
        `Features: ${
          Object.entries(merged)
            .map(([key, value]) => `${key} ${value}`)
            .join(", ") || "back to plan"
        }`
      );
    }

    if (details.length === 0) throw new BadRequestException(BILLING_ERROR_MESSAGES.NOTHING_TO_CHANGE);

    await this.subscriptionRepository.$transaction(async tx => {
      await this.subscriptionRepository.update(subscription.id, update, { tx });
      await this.subscriptionRepository.addChange(
        subscription.id,
        { action: "adjusted", reason: dto.reason, detail: details.join("; ") },
        { tx }
      );
      if (datesMoved) await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
      // A renewal quoted before the discount changed carries the old price.
      else if (discountChanged) await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx, kind: "RENEWAL" });
    });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return toSubscriptionView(updated as NonNullable<typeof updated>);
  }
}
