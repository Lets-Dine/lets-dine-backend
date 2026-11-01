import { resolveEntitlements } from "../entitlements.util";

const subscription = (featureOverrides: unknown) => ({
  id: "sub-1",
  restaurantId: "restaurant-1",
  status: "ACTIVE" as const,
  trialEndsAt: null,
  currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  pastDueSince: null,
  extraBranches: 0,
  extraSeats: 0,
  featureOverrides,
  plan: { id: "plan-1", key: "starter", limits: {}, features: { analyticsTier: "basic", exports: false } },
});

describe("resolveEntitlements featureOverrides", () => {
  it("should let an override win over the plan and leave other features on the plan's value", () => {
    // Act
    const { features } = resolveEntitlements(subscription({ exports: true }), new Date("2026-03-15T00:00:00.000Z"));

    // Assert
    expect(features).toMatchObject({ exports: true, analyticsTier: "basic", autoStockConsumption: true });
  });

  it("should follow the plan when there are no overrides", () => {
    // Act
    const { features } = resolveEntitlements(subscription(null), new Date("2026-03-15T00:00:00.000Z"));

    // Assert
    expect(features.exports).toBe(false);
  });
});
