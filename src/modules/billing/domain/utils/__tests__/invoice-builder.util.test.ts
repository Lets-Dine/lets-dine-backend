import { buildPlan } from "../../../application/__tests__/billing.fixtures";
import { buildInvoiceLines, buildInvoiceNumber, resolveInvoicePeriod, sumLines } from "../invoice-builder.util";

const monthly = { interval: "MONTHLY", extraBranches: 0, extraSeats: 0 } as const;

describe("buildInvoiceLines", () => {
  it("should bill just the monthly plan fee when there are no extras", () => {
    // Act
    const lines = buildInvoiceLines(buildPlan(), monthly);

    // Assert
    expect(lines).toEqual([{ description: "Growth plan — monthly", quantity: 1, unitAmount: 400000, amount: 400000 }]);
  });

  it("should bill the plan's own annual price for an annual subscription", () => {
    // Act
    const lines = buildInvoiceLines(buildPlan(), { ...monthly, interval: "ANNUAL" });

    // Assert
    expect(lines).toEqual([{ description: "Growth plan — annual", quantity: 1, unitAmount: 4000000, amount: 4000000 }]);
  });

  it("should add purchased extra branches at the plan's price", () => {
    // Act
    const lines = buildInvoiceLines(buildPlan(), { ...monthly, extraBranches: 2 });

    // Assert
    expect(lines[1]).toEqual({ description: "Extra branch", quantity: 2, unitAmount: 80000, amount: 160000 });
    expect(sumLines(lines)).toBe(560000);
  });

  it("should charge extras for 10 months on an annual subscription, matching the plan's own two free months", () => {
    // Act
    const lines = buildInvoiceLines(buildPlan(), { interval: "ANNUAL", extraBranches: 1, extraSeats: 0 });

    // Assert
    expect(lines[1]).toMatchObject({ description: "Extra branch", unitAmount: 800000, amount: 800000 });
  });

  it("should leave off an extra the plan has no price for, instead of inventing one", () => {
    // Act — the fixture plan has no seat price
    const lines = buildInvoiceLines(buildPlan(), { ...monthly, extraSeats: 3 });

    // Assert
    expect(lines).toHaveLength(1);
  });

  it("should bill a free plan at zero", () => {
    // Act
    const lines = buildInvoiceLines(buildPlan({ monthlyPrice: 0, annualPrice: 0, extraBranchPrice: null }), monthly);

    // Assert
    expect(sumLines(lines)).toBe(0);
  });
});

describe("resolveInvoicePeriod", () => {
  const now = new Date("2026-03-28T00:00:00.000Z");

  it("should invoice the period that starts when the current one ends, due that day", () => {
    // Act
    const period = resolveInvoicePeriod(new Date("2026-04-01T00:00:00.000Z"), "MONTHLY", now);

    // Assert
    expect(period).toEqual({
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-01T00:00:00.000Z"),
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("should start a lapsed subscription's next period now, so a late payer is not billed for time already gone", () => {
    // Act
    const period = resolveInvoicePeriod(new Date("2026-03-01T00:00:00.000Z"), "MONTHLY", now);

    // Assert
    expect(period).toEqual({ periodStart: now, periodEnd: new Date("2026-04-28T00:00:00.000Z"), dueAt: now });
  });
});

describe("buildInvoiceNumber", () => {
  it("should carry the period's date and be different every time", () => {
    // Act
    const first = buildInvoiceNumber(new Date("2026-04-01T00:00:00.000Z"));
    const second = buildInvoiceNumber(new Date("2026-04-01T00:00:00.000Z"));

    // Assert
    expect(first).toMatch(/^INV-20260401-[0-9A-F]{6}$/);
    expect(first).not.toBe(second);
  });
});
