import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { ISubscriptionUpdate, SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { ChangePlanInput } from "../../interfaces/http/validations/change-plan.validation";

export interface IChangePlanResult {
  /** `immediately` for a trial or an upgrade; `next_period` for a downgrade, which waits for the paid period to run out. */
  effective: "immediately" | "next_period";
  subscription: ISubscriptionView;
}

/**
 * An owner switching their own plan. Moving up (or sideways, or off a trial) takes
 * effect now and is billed from the next invoice; moving down is queued so a
 * restaurant keeps what it already paid for until the period ends. No proration yet.
 */
@Injectable()
export class ChangePlanUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly invoiceRepository: InvoiceRepository
  ) {}

  async execute(dto: ChangePlanInput, authEntity: AuthEntity): Promise<IChangePlanResult> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(authEntity.restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);

    const plan = await this.planRepository.findByKey(dto.planKey);
    if (!plan || !plan.isActive) throw new NotFoundException(BILLING_ERROR_MESSAGES.PLAN_NOT_FOUND);
    if (!plan.isPublic || plan.type !== "SUBSCRIPTION") throw new BadRequestException(BILLING_ERROR_MESSAGES.PLAN_NOT_AVAILABLE);

    const interval = dto.interval ?? subscription.interval;
    const samePlan = plan.id === subscription.plan.id;
    if (samePlan && interval === subscription.interval && !subscription.pendingPlanId) {
      throw new BadRequestException(BILLING_ERROR_MESSAGES.ALREADY_ON_PLAN);
    }

    // Going back to the current plan costs the same, so it lands here too — which is how a queued downgrade gets cancelled.
    const immediate = subscription.status === "TRIAL" || plan.monthlyPrice >= subscription.plan.monthlyPrice;
    const update: ISubscriptionUpdate = immediate
      ? { planId: plan.id, pendingPlanId: null, interval }
      : { pendingPlanId: plan.id, interval };

    await this.subscriptionRepository.$transaction(async tx => {
      await this.subscriptionRepository.update(subscription.id, update, { tx });
      // Whatever was open was priced on the old plan or interval.
      await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
    });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return {
      effective: immediate ? "immediately" : "next_period",
      subscription: toSubscriptionView(updated as NonNullable<typeof updated>),
    };
  }
}
