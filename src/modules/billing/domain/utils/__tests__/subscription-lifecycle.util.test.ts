import { SubscriptionStatus } from "@prisma/client";
import { ILifecycleInput, resolveSubscriptionState } from "../subscription-lifecycle.util";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-03-01T00:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const daysAhead = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const subscription = (overrides: Partial<ILifecycleInput> & { status: SubscriptionStatus }): ILifecycleInput => ({
  trialEndsAt: null,
  currentPeriodEnd: daysAhead(10),
  pastDueSince: null,
  ...overrides,
});

describe("resolveSubscriptionState", () => {
  describe("trial", () => {
    it("should leave a running trial untouched", () => {
      // Arrange
      const input = subscription({ status: "TRIAL", trialEndsAt: daysAhead(5) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result).toEqual({ status: "TRIAL", pastDueSince: null, changed: false });
    });

    it("should restrict straight away once the trial ends, since the trial was the grace period", () => {
      // Arrange
      const input = subscription({ status: "TRIAL", trialEndsAt: daysAgo(1) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result.status).toBe("RESTRICTED");
      expect(result.pastDueSince).toEqual(input.trialEndsAt);
      expect(result.changed).toBe(true);
    });
  });

  describe("active", () => {
    it("should stay active while the period is still running", () => {
      // Arrange
      const input = subscription({ status: "ACTIVE", currentPeriodEnd: daysAhead(1) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result.changed).toBe(false);
      expect(result.status).toBe("ACTIVE");
    });

    it("should go past due from the moment the period ended unpaid", () => {
      // Arrange
      const periodEnd = daysAgo(2);
      const input = subscription({ status: "ACTIVE", currentPeriodEnd: periodEnd });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result).toEqual({ status: "PAST_DUE", pastDueSince: periodEnd, changed: true });
    });
  });

  describe("overdue stages", () => {
    it.each([
      [3, "PAST_DUE"],
      [7, "RESTRICTED"],
      [20, "RESTRICTED"],
      [21, "SUSPENDED"],
      [80, "SUSPENDED"],
      [81, "CANCELLED"],
    ] as const)("should be %s days overdue -> %s", (days, expected) => {
      // Arrange
      const input = subscription({ status: "PAST_DUE", pastDueSince: daysAgo(days) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result.status).toBe(expected);
    });

    it("should land on the right stage in one call when the job missed several days", () => {
      // Arrange — active, period ended 30 days ago, never processed
      const input = subscription({ status: "ACTIVE", currentPeriodEnd: daysAgo(30) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result.status).toBe("SUSPENDED");
      expect(result.pastDueSince).toEqual(input.currentPeriodEnd);
    });

    it("should never move a later stage backwards", () => {
      // Arrange — restricted by trial expiry only 2 days ago, so still inside the grace window by elapsed time
      const input = subscription({ status: "RESTRICTED", pastDueSince: daysAgo(2) });

      // Act
      const result = resolveSubscriptionState(input, NOW);

      // Assert
      expect(result).toEqual({ status: "RESTRICTED", pastDueSince: input.pastDueSince, changed: false });
    });

    it("should honour a custom schedule", () => {
      // Arrange
      const input = subscription({ status: "PAST_DUE", pastDueSince: daysAgo(3) });

      // Act
      const result = resolveSubscriptionState(input, NOW, { graceDays: 2, restrictedDays: 5, suspendedDays: 30 });

      // Assert
      expect(result.status).toBe("RESTRICTED");
    });
  });

  it("should leave a cancelled subscription alone", () => {
    // Arrange
    const input = subscription({ status: "CANCELLED", pastDueSince: daysAgo(200), currentPeriodEnd: daysAgo(200) });

    // Act
    const result = resolveSubscriptionState(input, NOW);

    // Assert
    expect(result.changed).toBe(false);
    expect(result.status).toBe("CANCELLED");
  });
});
