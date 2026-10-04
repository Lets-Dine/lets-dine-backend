import { SubscriptionStatus } from "@prisma/client";
import {
  PlanFeaturesConfig,
  PlanLimitsConfig,
  planFeaturesSchema,
  planLimitsSchema,
} from "../../interfaces/http/validations/plan-config.validation";
import { IBillingSubscription, IEntitlements, IUsageMeter, UsageLevel } from "../interfaces/billing.interface";

/** Statuses in which configuration edits are blocked. Orders and payments are never gated by status. */
const RESTRICTED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["RESTRICTED", "SUSPENDED", "CANCELLED"]);

const WARN_RATIO = 0.8;

export const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

/**
 * A restaurant with no subscription row predates billing: it keeps full access
 * rather than being locked out by a missing record. The backfill migration should
 * leave none of these, so this is the safety net, not the normal path.
 */
export function grandfatheredEntitlements(now: Date): IEntitlements {
  return {
    planKey: "grandfathered",
    status: null,
    limits: {},
    features: planFeaturesSchema.parse({ analyticsTier: "full", exports: true }),
    restricted: false,
    periodStart: startOfUtcMonth(now),
  };
}

const addExtra = (base: number | undefined, extra: number): number | undefined => (base === undefined ? undefined : base + extra);

/** Parses the plan's JSON at the boundary — a malformed plan throws instead of silently granting or denying access. */
export function resolveEntitlements(subscription: IBillingSubscription, now: Date): IEntitlements {
  const limits: PlanLimitsConfig = planLimitsSchema.parse(subscription.plan.limits);
  const features: PlanFeaturesConfig = planFeaturesSchema.parse(subscription.plan.features);

  return {
    planKey: subscription.plan.key,
    status: subscription.status,
    limits: {
      ...limits,
      branches: addExtra(limits.branches, subscription.extraBranches),
      staffSeats: addExtra(limits.staffSeats, subscription.extraSeats),
    },
    features,
    restricted: RESTRICTED_STATUSES.has(subscription.status),
    periodStart: startOfUtcMonth(now),
  };
}

export function usageLevel(used: number, limit: number | undefined): UsageLevel {
  if (limit === undefined) return "ok";
  if (used >= limit) return "over";
  if (used >= limit * WARN_RATIO) return "warn";
  return "ok";
}

export function buildMeter(used: number, limit: number | undefined): IUsageMeter {
  return { used, limit, level: usageLevel(used, limit) };
}
