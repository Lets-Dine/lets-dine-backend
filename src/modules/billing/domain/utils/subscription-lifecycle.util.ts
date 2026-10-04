import { SubscriptionStatus } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long each stage of an unpaid subscription lasts, counted from `pastDueSince`. */
export interface ILifecycleConfig {
  /** Full service, reminders only. */
  graceDays: number;
  /** Configuration locked; orders and payments still work. */
  restrictedDays: number;
  /** Staff locked out, the owner can still pay. After this the subscription is cancelled. */
  suspendedDays: number;
}

export const DEFAULT_LIFECYCLE_CONFIG: ILifecycleConfig = { graceDays: 7, restrictedDays: 14, suspendedDays: 60 };

export interface ILifecycleInput {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
}

export interface ILifecycleResult {
  status: SubscriptionStatus;
  pastDueSince: Date | null;
  changed: boolean;
}

/** Later stages outrank earlier ones — a subscription only moves forward here, paying is what moves it back. */
const STAGE_RANK: Record<SubscriptionStatus, number> = {
  TRIAL: 0,
  ACTIVE: 0,
  PAST_DUE: 1,
  RESTRICTED: 2,
  SUSPENDED: 3,
  CANCELLED: 4,
};

/**
 * Where a subscription should be at `now`. Pure so the scheduled job stays a thin
 * loop around it, and so a job that missed several days still lands on the right
 * stage in one call instead of stepping through each one.
 *
 * - TRIAL ends straight into RESTRICTED: the trial itself was the grace period.
 * - ACTIVE becomes PAST_DUE once its period ends unpaid (paying extends the period).
 * - From `pastDueSince` it then walks PAST_DUE -> RESTRICTED -> SUSPENDED -> CANCELLED by elapsed days.
 */
export function resolveSubscriptionState(
  input: ILifecycleInput,
  now: Date,
  config: ILifecycleConfig = DEFAULT_LIFECYCLE_CONFIG
): ILifecycleResult {
  const unchanged: ILifecycleResult = { status: input.status, pastDueSince: input.pastDueSince, changed: false };
  if (input.status === "CANCELLED") return unchanged;

  let status: SubscriptionStatus = input.status;
  let since = input.pastDueSince;

  if (status === "TRIAL") {
    if (!input.trialEndsAt || now < input.trialEndsAt) return unchanged;
    status = "RESTRICTED";
    since = input.trialEndsAt;
  } else if (status === "ACTIVE") {
    if (now <= input.currentPeriodEnd) return unchanged;
    status = "PAST_DUE";
    since = input.currentPeriodEnd;
  }

  if (!since) return { status, pastDueSince: since, changed: status !== input.status };

  const elapsedDays = (now.getTime() - since.getTime()) / DAY_MS;
  const restrictedAt = config.graceDays;
  const suspendedAt = restrictedAt + config.restrictedDays;
  const cancelledAt = suspendedAt + config.suspendedDays;

  let target: SubscriptionStatus = "PAST_DUE";
  if (elapsedDays >= cancelledAt) target = "CANCELLED";
  else if (elapsedDays >= suspendedAt) target = "SUSPENDED";
  else if (elapsedDays >= restrictedAt) target = "RESTRICTED";

  if (STAGE_RANK[target] > STAGE_RANK[status]) status = target;

  return { status, pastDueSince: since, changed: status !== input.status || since !== input.pastDueSince };
}
