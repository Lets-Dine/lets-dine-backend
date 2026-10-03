import { ForbiddenException } from "../../../../common/exceptions";
import { AuthEntity, canAccessBranch } from "../../../../common/interfaces";
import { IAnalyticsScope } from "../interfaces/analytics.interface";

export const ANALYTICS_BRANCH_ERROR_MESSAGES = {
  FORBIDDEN: { key: "ANALYTICS_BRANCH_FORBIDDEN", message: "You do not have access to this branch's analytics" },
};

/**
 * Owners read the whole restaurant unless they narrow to one branch; everybody else reads the
 * branches they are assigned to, and may only narrow within them. A `branchId` from another
 * restaurant needs no check of its own — every query also filters on `restaurantId`, so it matches nothing.
 */
export function resolveAnalyticsScope(authEntity: AuthEntity, requestedBranchId?: string): IAnalyticsScope {
  const { restaurantId, branchIds } = authEntity;

  if (requestedBranchId) {
    if (!canAccessBranch(authEntity, requestedBranchId)) throw new ForbiddenException(ANALYTICS_BRANCH_ERROR_MESSAGES.FORBIDDEN);
    return { restaurantId, branchIds: [requestedBranchId] };
  }

  return { restaurantId, branchIds: branchIds === "all" ? undefined : branchIds };
}
