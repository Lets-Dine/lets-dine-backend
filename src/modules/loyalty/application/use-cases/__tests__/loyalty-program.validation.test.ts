import { updateLoyaltyProgramSchema } from "../../../interfaces/http/validations/loyalty.validation";

const ok = { enabled: true, spendPerPoint: 10000, redeemValue: 50, maxRedeemPct: 100, reviewBonus: 1 };

describe("updateLoyaltyProgramSchema", () => {
  it("should accept rules where a point is worth less than the spending that earns it", () => {
    // Act & Assert
    expect(updateLoyaltyProgramSchema.safeParse(ok).success).toBe(true);
    expect(updateLoyaltyProgramSchema.safeParse({ ...ok, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50 }).success).toBe(true);
  });

  it("should refuse rules that let a diner earn back more than they spend in points", () => {
    // Arrange: points may pay for all of a bill and each is worth as much as the spending that earns one.
    const result = updateLoyaltyProgramSchema.safeParse({ ...ok, spendPerPoint: 100, redeemValue: 100, maxRedeemPct: 100 });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should refuse the break-even line itself, where cycling points is free", () => {
    // Arrange: all of a bill may be paid in points and each point is worth exactly the spending that earns one.
    const result = updateLoyaltyProgramSchema.safeParse({ ...ok, spendPerPoint: 1000, redeemValue: 1000, maxRedeemPct: 100 });

    // Assert
    expect(result.success).toBe(false);
  });
});
