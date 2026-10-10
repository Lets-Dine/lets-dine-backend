import { StaffRole } from "@prisma/client";

/**
 * What a verified staff access token carries. Restaurant scope lives in the
 * token, never in the request body — §36: never trust a client-supplied
 * restaurantId for authorization.
 */
export interface AuthEntity {
  /** User id. */
  sub: string;
  email: string;
  name: string;
  memberId: string;
  restaurantId: string;
  role: StaffRole;
  /** The branch this session is currently working in. Every branch-scoped query filters on it. */
  branchId: string;
  /** Branches this member may switch to; `"all"` for an OWNER, who reaches every branch. */
  branchIds: string[] | "all";
}

/**
 * Whether a branch-scoped row sits in this session's restaurant AND active branch. Single-row
 * lookups use it in place of the bare `restaurantId` comparison; callers 404 on false so another
 * branch's data is indistinguishable from nonexistent.
 */
export function isInActiveBranch(
  authEntity: Pick<AuthEntity, "restaurantId" | "branchId">,
  row: { restaurantId: string; branchId: string | null }
): boolean {
  return row.restaurantId === authEntity.restaurantId && row.branchId === authEntity.branchId;
}

/** Whether the token's holder may work in the given branch. */
export function canAccessBranch(authEntity: Pick<AuthEntity, "branchIds">, branchId: string): boolean {
  return authEntity.branchIds === "all" || authEntity.branchIds.includes(branchId);
}
