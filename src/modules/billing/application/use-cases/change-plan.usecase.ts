import { Injectable } from "@nestjs/common";
import { BillingInterval } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { IInvoice, IPlan, ISubscriptionDetail, ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../domain/repositories/plan.repository";
import { ISubscriptionUpdate, SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { UsageRepository } from "../../domain/repositories/usage.repository";
import { planLimitsSchema } from "../../interfaces/http/validations/plan-config.validation";
import { buildInvoiceNumber } from "../../domain/utils/invoice-builder.util";
import { planPriceFor, prorateUpgrade } from "../../domain/utils/proration.util";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";
import { ChangePlanInput } from "../../interfaces/http/validations/change-plan.validation";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IChangePlanResult {
  /** `immediately` for an upgrade that costs nothing; `next_period` for a downgrade, which waits for the paid period to run out. */
  effective: "immediately" | "next_period" | "on_payment";
  subscription: ISubscriptionView;
  /** `on_payment` only: the prorated invoice to pay before the new plan starts. */
  invoice?: IInvoice;
}

/**
 * An owner switching their own plan. Moving up (or sideways) takes
 * effect now and is billed from the next invoice; moving down is queued so a
 * restaurant keeps what it already paid for until the period ends. Moving up on a paid period
 * is an upgrade invoice for the prorated difference, and the plan switches when it is paid.
 */
@Injectable()
export class ChangePlanUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly usageRepository: UsageRepository
  ) {}

  async execute(dto: ChangePlanInput, authEntity: AuthEntity, now: Date = new Date()): Promise<IChangePlanResult> {
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

    if (subscription.status === "TRIAL" && !samePlan) throw new BadRequestException(BILLING_ERROR_MESSAGES.TRIAL_PLAN_LOCKED);
    if (!samePlan) await this.assertFitsPlan(plan, subscription, authEntity.restaurantId);

    // Moving up mid-period is paid for before it starts: the price difference for the days left.
    const prorated = subscription.status === "ACTIVE" && !samePlan ? this.upgradeCharge(plan, subscription, now) : 0;
    if (prorated > 0) return this.requestUpgrade(plan, subscription, interval, prorated, now);

    // Going back to the current plan costs the same, so it lands here too — which is how a queued downgrade gets cancelled.
    const immediate = plan.monthlyPrice >= subscription.plan.monthlyPrice;
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

  private upgradeCharge(plan: IPlan, subscription: ISubscriptionDetail, now: Date): number {
    return prorateUpgrade(
      { from: planPriceFor(subscription.plan, subscription.interval), to: planPriceFor(plan, subscription.interval) },
      { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
      now
    );
  }

  /** The plan only changes when this invoice is paid (see InvoiceSettlementService); until then the subscription is untouched but for the interval. */
  private async requestUpgrade(
    plan: IPlan,
    subscription: ISubscriptionDetail,
    interval: BillingInterval,
    amount: number,
    now: Date
  ): Promise<IChangePlanResult> {
    const daysLeft = Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS);
    const invoice = await this.subscriptionRepository.$transaction(async tx => {
      await this.invoiceRepository.voidOpenForSubscription(subscription.id, { tx, kind: "UPGRADE" });
      if (interval !== subscription.interval) await this.subscriptionRepository.update(subscription.id, { interval }, { tx });
      return this.invoiceRepository.create(
        {
          subscriptionId: subscription.id,
          restaurantId: subscription.restaurantId,
          number: buildInvoiceNumber(now),
          lines: [
            {
              description: `Upgrade ${subscription.plan.name} → ${plan.name}, ${daysLeft} days left in this period`,
              quantity: 1,
              unitAmount: amount,
              amount,
            },
          ],
          amount,
          currency: plan.currency,
          periodStart: now,
          periodEnd: subscription.currentPeriodEnd,
          dueAt: now,
          kind: "UPGRADE",
          upgradePlanId: plan.id,
        },
        { tx }
      );
    });

    const updated = await this.subscriptionRepository.findDetailById(subscription.id);
    return { effective: "on_payment", invoice, subscription: toSubscriptionView(updated as NonNullable<typeof updated>) };
  }

  /** A plan whose limits are below what the restaurant already runs can't be switched to — it would leave it over the cap. */
  private async assertFitsPlan(
    plan: IPlan,
    subscription: { extraBranches: number; extraSeats: number },
    restaurantId: string
  ): Promise<void> {
    const limits = planLimitsSchema.parse(plan.limits);
    const [branches, seats] = await Promise.all([
      this.usageRepository.countActiveBranches(restaurantId),
      this.usageRepository.countActiveSeats(restaurantId),
    ]);
    const cap = (base: number | undefined, extra: number, price: number | null) =>
      base === undefined ? undefined : base + (price === null ? 0 : extra);

    const blockers: { kind: "branches" | "seats"; used: number; limit: number; remove: number }[] = [];
    const branchLimit = cap(limits.branches, subscription.extraBranches, plan.extraBranchPrice);
    const seatLimit = cap(limits.staffSeats, subscription.extraSeats, plan.extraSeatPrice);
    if (branchLimit !== undefined && branches > branchLimit)
      blockers.push({ kind: "branches", used: branches, limit: branchLimit, remove: branches - branchLimit });
    if (seatLimit !== undefined && seats > seatLimit)
      blockers.push({ kind: "seats", used: seats, limit: seatLimit, remove: seats - seatLimit });
    if (blockers.length === 0) return;

    const what = blockers.map(b => `${b.used} active ${b.kind} (${plan.name} allows ${b.limit}) — remove ${b.remove}`).join("; ");
    throw new BadRequestException({
      ...BILLING_ERROR_MESSAGES.DOWNGRADE_BLOCKED,
      message: `You can't switch to ${plan.name} yet: you have ${what}. Deactivate the extra branches or staff and try again.`,
      detail: { blockers },
    });
  }
}
