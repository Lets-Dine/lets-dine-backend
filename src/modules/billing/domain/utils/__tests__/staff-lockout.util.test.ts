import { StaffRole, SubscriptionStatus } from "@prisma/client";
import { isStaffLockedOut } from "../staff-lockout.util";

const WORKING: SubscriptionStatus[] = ["TRIAL", "ACTIVE", "PAST_DUE", "RESTRICTED"];
const LOCKED: SubscriptionStatus[] = ["SUSPENDED", "CANCELLED"];
const ROLES: StaffRole[] = ["OWNER", "MANAGER", "STAFF"];

describe("isStaffLockedOut", () => {
  describe("while the restaurant can still operate", () => {
    it.each(WORKING.flatMap(status => ROLES.map(role => [status, role] as const)))("should lock out nobody: %s / %s", (status, role) => {
      // Act & Assert — restricted only limits configuration edits; it never closes the restaurant
      expect(isStaffLockedOut(status, role, false)).toBe(false);
    });

    it.each(ROLES)("should lock out nobody without a subscription (a restaurant that predates billing): %s", role => {
      // Act & Assert
      expect(isStaffLockedOut(null, role, false)).toBe(false);
    });
  });

  describe("once suspended or cancelled", () => {
    it.each(LOCKED.flatMap(status => (["MANAGER", "STAFF"] as const).map(role => [status, role] as const)))(
      "should lock out a %s %s everywhere, even on a route marked for owners",
      (status, role) => {
        // Act & Assert
        expect(isStaffLockedOut(status, role, true)).toBe(true);
        expect(isStaffLockedOut(status, role, false)).toBe(true);
      }
    );

    it.each(LOCKED)("should let the owner reach only the routes marked for them when %s, so they can pay", status => {
      // Act & Assert
      expect(isStaffLockedOut(status, "OWNER", true)).toBe(false);
      expect(isStaffLockedOut(status, "OWNER", false)).toBe(true);
    });
  });
});
