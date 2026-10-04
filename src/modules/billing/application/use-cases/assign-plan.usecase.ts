import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { AssignPlanInput } from "../../interfaces/http/validations/assign-plan.validation";

/**
 * Platform-side plan assignment: any plan (including ones owners cannot pick
 * themselves, like Enterprise), effective immediately, with purchased extras.
 * It is how a custom deal or a purchased add-on gets onto a subscription.
 */
@Injectable()
export class AssignPlanUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly invoiceRepository: InvoiceRepository
  ) {}

  async execute(restaurantId: string, dto: AssignPlanInput): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);

    const plan = await this.planRepository.findByKey(dto.planKey);
    if (!plan || !plan.isActive) throw new NotFoundException(BILLING_ERROR_MESSAGES.PLAN_NOT_FOUND);

    const extraBranches = dto.extraBranches ?? subscription.extraBranches;
    const extraSeats = dto.extraSeats ?? subscription.extraSeats;
    if ((extraBranches > 0 && plan.extraBranchPrice === null) || (extraSeats > 0 && plan.extraSeatPrice === null)) {
      throw new BadRequestException(BILLING_ERROR_MESSAGES.EXTRAS_NOT_AVAILABLE);
    }

    await this.subscriptionRepository.$transaction(async tx => {
      await this.subscriptionRepository.update(
        subscription.id,
        { planId: plan.id, pendingPlanId: null, interval: dto.interval ?? subscription.interval, extraBranches, extraSeats },
        { tx }
      );
      // Anything open was priced on the old arrangement.
      await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx });
    });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return toSubscriptionView(updated as NonNullable<typeof updated>);
  }
}
