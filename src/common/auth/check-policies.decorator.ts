import { SetMetadata } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { can, Permission } from "./permissions";

export const CHECK_POLICIES_KEY = "check_policies";

export type PolicyHandler = (role: StaffRole) => boolean;

/**
 * Outer array is OR, inner array is AND — `[["menu:edit"], ["settings:edit"]]`
 * passes for a role holding either, `[["menu:edit", "menu:price"]]` needs both.
 */
export function checkPermissionRules(rules: Permission[][]): PolicyHandler {
  return (role: StaffRole) => rules.some(rule => rule.every(permission => can(role, permission)));
}

export const CheckPolicies = (...handlers: PolicyHandler[]) => SetMetadata(CHECK_POLICIES_KEY, handlers);
