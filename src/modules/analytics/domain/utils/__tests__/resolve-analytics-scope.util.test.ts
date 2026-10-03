import { ForbiddenException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { resolveAnalyticsScope } from "../resolve-analytics-scope.util";

describe("resolveAnalyticsScope", () => {
  const owner = buildAuthEntity({ branchIds: "all" });
  const manager = buildAuthEntity({ role: "MANAGER" as any, branchIds: ["branch-a", "branch-b"] });

  it("gives an owner the whole restaurant by default", () => {
    expect(resolveAnalyticsScope(owner)).toEqual({ restaurantId: owner.restaurantId, branchIds: undefined });
  });

  it("lets an owner narrow to any one branch", () => {
    expect(resolveAnalyticsScope(owner, "branch-z")).toEqual({ restaurantId: owner.restaurantId, branchIds: ["branch-z"] });
  });

  it("limits a manager to their assigned branches by default", () => {
    expect(resolveAnalyticsScope(manager)).toEqual({ restaurantId: manager.restaurantId, branchIds: ["branch-a", "branch-b"] });
  });

  it("lets a manager narrow within their branches", () => {
    expect(resolveAnalyticsScope(manager, "branch-b")).toEqual({ restaurantId: manager.restaurantId, branchIds: ["branch-b"] });
  });

  it("forbids a manager from reading a branch they are not assigned to", () => {
    expect(() => resolveAnalyticsScope(manager, "branch-z")).toThrow(ForbiddenException);
  });
});
