import { BillingInterval, InvoiceKind, InvoiceStatus, PlanType, SubscriptionStatus } from "@prisma/client";
import { PlanFeaturesConfig, PlanLimitsConfig } from "../../interfaces/http/validations/plan-config.validation";

/** A subscription joined to its plan. `limits`/`features` are raw JSON until the entitlement service parses them. */
export interface IBillingSubscription {
  id: string;
  restaurantId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
  extraBranches: number;
  extraSeats: number;
  plan: { id: string; key: string; limits: unknown; features: unknown };
}

/** What a restaurant may do right now. A limit left undefined is unlimited. */
export interface IEntitlements {
  planKey: string;
  /** Null for a restaurant that predates billing and has no subscription row — it keeps full access. */
  status: SubscriptionStatus | null;
  /** Plan limits with purchased add-ons already included. */
  limits: PlanLimitsConfig;
  features: PlanFeaturesConfig;
  /** Configuration edits are blocked; orders and payments never are. */
  restricted: boolean;
  /** Start of the UTC calendar month the order counter is keyed on — "orders per month" is a calendar month, independent of the paid window. */
  periodStart: Date;
}

export type EntitlementKind = "branch" | "seat";

export type FeatureKey = "exports" | "analyticsFull" | "autoStockConsumption";

/** ok below 80% of the limit, warn from 80%, over once the limit is reached. */
export type UsageLevel = "ok" | "warn" | "over";

export interface IUsageMeter {
  used: number;
  /** Undefined when unlimited. */
  limit?: number;
  level: UsageLevel;
}

export interface IUsage {
  orders: IUsageMeter;
  branches: IUsageMeter;
  seats: IUsageMeter;
}

/** A plan as stored; `limits`/`features` stay raw JSON until `toPlanView` parses them. */
export interface IPlan {
  id: string;
  key: string;
  name: string;
  type: PlanType;
  monthlyPrice: number;
  annualPrice: number;
  extraBranchPrice: number | null;
  extraSeatPrice: number | null;
  currency: string;
  limits: unknown;
  features: unknown;
  isPublic: boolean;
  isActive: boolean;
}

/**
 * A plan with its JSON parsed — what the API returns. The prices are null when the caller
 * may see what the restaurant is on but not what it costs (a manager).
 */
export interface IPlanView
  extends Omit<IPlan, "limits" | "features" | "id" | "isActive" | "monthlyPrice" | "annualPrice" | "extraBranchPrice" | "extraSeatPrice"> {
  monthlyPrice: number | null;
  annualPrice: number | null;
  extraBranchPrice: number | null;
  extraSeatPrice: number | null;
  limits: PlanLimitsConfig;
  features: PlanFeaturesConfig;
}

/** What the public pricing page may show: self-serve plans, plus which plan a new restaurant trials. */
export interface IPublicPlanCatalogue {
  plans: IPlanView[];
  trialDays: number;
  trialPlanKey: string;
}

/** The platform Plans page: the catalogue plus how many restaurants are on each plan, by plan key. */
export interface IPlatformPlans {
  plans: IPlanView[];
  counts: Record<string, number>;
}

export interface ISubscriptionDetail {
  id: string;
  restaurantId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
  pendingPlanId: string | null;
  extraBranches: number;
  extraSeats: number;
  cancelledAt: Date | null;
  plan: IPlan;
  /** The downgrade queued for the end of the period, if any. */
  pendingPlan: IPlan | null;
}

export interface ISubscriptionView extends Omit<ISubscriptionDetail, "plan" | "pendingPlan" | "pendingPlanId"> {
  plan: IPlanView;
  pendingPlan: IPlanView | null;
  /** This restaurant's slug, the code on its invite link. */
  referralCode?: string;
}

/** A restaurant this one invited, and whether their first payment has added a month. */
export interface IReferral {
  id: string;
  name: string;
  joinedAt: Date;
  rewardedAt: Date | null;
}

export interface IReferrals {
  code: string;
  referrals: IReferral[];
}

/** Just what the lifecycle sweep needs to decide a subscription's next stage. */
export interface ILifecycleSubscription {
  id: string;
  restaurantId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
}

export interface IInvoiceLine {
  description: string;
  quantity: number;
  /** Minor units. */
  unitAmount: number;
  amount: number;
}

export interface IInvoice {
  id: string;
  subscriptionId: string;
  restaurantId: string;
  number: string;
  lines: IInvoiceLine[];
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  status: InvoiceStatus;
  kind: InvoiceKind;
  upgradePlanId: string | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  markedPaidBy: string | null;
  createdAt: Date;
}

/** One row of the platform restaurant listing: the restaurant, its subscription and plan, and a light usage read. */
export interface ITenantListItem {
  id: string;
  name: string;
  slug: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  /** Newest order, or null when the restaurant has never taken one. */
  lastActiveAt: Date | null;
  owner: { name: string; email: string } | null;
  plan: { key: string; name: string };
  status: SubscriptionStatus;
  interval: BillingInterval;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
  /** Active branches and staff seats in use, against `limits` plus the purchased extras. */
  branches: number;
  seats: number;
  extraBranches: number;
  extraSeats: number;
  limits: PlanLimitsConfig;
  ordersThisMonth: number;
  ordersLastMonth: number;
  /** Orders per week, oldest first, the last 8 weeks. */
  weekly: number[];
  /** Monthly recurring revenue in minor units; 0 unless the restaurant is billing. */
  mrr: number;
}

/** Restaurant counts per listing view, for the filter pills. */
export interface ITenantViewCounts {
  all: number;
  active: number;
  trial: number;
  attention: number;
  closed: number;
}
