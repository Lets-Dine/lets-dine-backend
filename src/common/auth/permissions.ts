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
  | "audit:view"
  | "payments:view"
  | "customers:view"
  | "payments:discount"
  | "ledger:view"
  | "ledger:manage"
  | "ledger:reopen"
  | "billing:view"
  | "billing:manage";

const STAFF: Permission[] = ["orders:view", "orders:advance", "menu:view", "payments:view", "customers:view"];

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
  "payments:discount",
  // Expenses and cash-up: the money side of the shift. A manager keeps the books, staff only ring up bills.
  "ledger:view",
  "ledger:manage",
  // Status and usage, so a manager knows what the restaurant is on and when it needs attention. No money.
  "billing:view",
];

export const ROLE_GRANTS: Record<StaffRole, Permission[]> = {
  STAFF,
  MANAGER,
  // Prices, invoices and changing plan are the owner's: it is the owner who commits the restaurant to a plan.
  // Taking a close back undoes a manager's count, so it is the owner's call.
  OWNER: [...MANAGER, "settings:edit", "billing:manage", "ledger:reopen"],
};

export function can(role: StaffRole, permission: Permission): boolean {
  return ROLE_GRANTS[role].includes(permission);
}
