import { StaffRole, SubscriptionStatus } from "@prisma/client";

/** Once suspended (and after cancellation) the restaurant is closed to its staff until it is paid up. */
const LOCKED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["SUSPENDED", "CANCELLED"]);

/**
 * Whether a staff member is locked out of the app by the subscription's state.
 *
 * Everyone except the owner is locked out entirely. The owner is locked out too —
 * except from what `allowedWhenSuspended` marks, which is how they reach billing to
 * pay. No subscription (a restaurant that predates billing) locks nobody out.
 */
export function isStaffLockedOut(status: SubscriptionStatus | null, role: StaffRole, allowedWhenSuspended: boolean): boolean {
  if (!status || !LOCKED_STATUSES.has(status)) return false;
  return role !== "OWNER" || !allowedWhenSuspended;
}
