import { SetMetadata } from "@nestjs/common";
import { StaffRole } from "@prisma/client";

export const ALLOW_WHEN_SUSPENDED_KEY = "allow_when_suspended";

/**
 * Marks a route an owner can still reach after the restaurant's subscription has
 * been suspended — billing, and the profile call a dashboard needs to render at all.
 * Everything else is closed to everyone until the account is paid up.
 */
export const AllowWhenSuspended = () => SetMetadata(ALLOW_WHEN_SUSPENDED_KEY, true);

export interface IStaffAccessSubject {
  restaurantId: string;
  role: StaffRole;
}

/**
 * Whether a signed-in staff member may use the app right now, beyond what their
 * role allows. A contract rather than a billing import so `common/auth` stays free
 * of feature modules: the billing module provides the implementation, and a build
 * without it simply has no such restriction.
 */
export abstract class StaffAccessPolicy {
  /** Throws ForbiddenException when this member is locked out. `allowedWhenSuspended` is true for sign-in and for @AllowWhenSuspended routes. */
  abstract assertCanAccess(subject: IStaffAccessSubject, options?: { allowedWhenSuspended?: boolean }): Promise<void>;
}
