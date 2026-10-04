import { IPlan, IPlanView, ISubscriptionDetail, ISubscriptionView } from "../interfaces/billing.interface";
import { planFeaturesSchema, planLimitsSchema } from "../../interfaces/http/validations/plan-config.validation";

export interface IViewOptions {
  /** Whether the caller may see what the plan costs. Defaults to true; a manager sees the plan, not the price. */
  showPrices?: boolean;
}

/** Parses the plan's JSON and drops the internal fields, for returning a plan over the API. */
export function toPlanView(plan: IPlan, options: IViewOptions = {}): IPlanView {
  const showPrices = options.showPrices ?? true;

  return {
    key: plan.key,
    name: plan.name,
    type: plan.type,
    monthlyPrice: showPrices ? plan.monthlyPrice : null,
    annualPrice: showPrices ? plan.annualPrice : null,
    extraBranchPrice: showPrices ? plan.extraBranchPrice : null,
    extraSeatPrice: showPrices ? plan.extraSeatPrice : null,
    currency: plan.currency,
    isPublic: plan.isPublic,
    limits: planLimitsSchema.parse(plan.limits),
    features: planFeaturesSchema.parse(plan.features),
  };
}

/** The subscription as the API returns it: plans parsed, the internal pending-plan id folded away. */
export function toSubscriptionView(subscription: ISubscriptionDetail, options: IViewOptions = {}): ISubscriptionView {
  const { plan, pendingPlan, pendingPlanId: _pendingPlanId, ...rest } = subscription;
  return { ...rest, plan: toPlanView(plan, options), pendingPlan: pendingPlan ? toPlanView(pendingPlan, options) : null };
}
