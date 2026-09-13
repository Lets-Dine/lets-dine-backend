import { StaffRole } from "@prisma/client";

/**
 * §50 — the same three roles and the same permission strings the dashboard's
 * `can()` uses. The UI hides a control as a courtesy; this is the rule.
 */
export type Permission =
  | "orders:view"
  | "orders:advance"
  | "orders:cancel"
  | "menu:view"
  | "menu:edit"
  | "menu:price"
  | "tables:view"
  | "tables:edit"
  | "reviews:view"
  | "analytics:view"
  | "settings:view"
  | "settings:edit"
  | "audit:view";

const STAFF: Permission[] = ["orders:view", "orders:advance", "menu:view"];

const MANAGER: Permission[] = [
  ...STAFF,
  "orders:cancel",
  "menu:edit",
  "menu:price",
  "tables:view",
  "tables:edit",
  "reviews:view",
  "analytics:view",
  "settings:view",
  "audit:view",
];

export const ROLE_GRANTS: Record<StaffRole, Permission[]> = {
  STAFF,
  MANAGER,
  OWNER: [...MANAGER, "settings:edit"],
};

export function can(role: StaffRole, permission: Permission): boolean {
  return ROLE_GRANTS[role].includes(permission);
}
