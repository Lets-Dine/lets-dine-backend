import { applyInvoicePayment, IPaymentTarget } from "../invoice-payment.util";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const target = (overrides: Partial<IPaymentTarget> = {}): IPaymentTarget => ({
  interval: "MONTHLY",
  currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
  pendingPlanId: null,
  ...overrides,
});
const invoice = (periodStart: string, periodEnd: string) => ({ periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) });

describe("applyInvoicePayment", () => {
  it("should keep the window continuous when paid early, leaving its own start in place", () => {
    // Act — the invoice covers April; it is paid on 28 March
    const result = applyInvoicePayment(target(), invoice("2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"), NOW);

    // Assert
    expect(result.currentPeriodStart).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    expect(result.currentPeriodEnd).toEqual(new Date("2026-05-01T00:00:00.000Z"));
  });

  it("should take the invoice's own window when paid inside it", () => {
    // Act — a lapsed subscription invoiced from 25 March, paid on the 28th
    const result = applyInvoicePayment(target(), invoice("2026-03-25T00:00:00.000Z", "2026-04-25T00:00:00.000Z"), NOW);

    // Assert
    expect(result.currentPeriodStart).toEqual(new Date("2026-03-25T00:00:00.000Z"));
    expect(result.currentPeriodEnd).toEqual(new Date("2026-04-25T00:00:00.000Z"));
  });

  it("should start fresh from now when paid after the invoiced period already ended, instead of landing straight back in PAST_DUE", () => {
    // Act
    const result = applyInvoicePayment(target(), invoice("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"), NOW);

    // Assert
    expect(result.currentPeriodStart).toEqual(NOW);
    expect(result.currentPeriodEnd).toEqual(new Date("2026-04-28T00:00:00.000Z"));
  });

  it("should restore ACTIVE and clear everything that tracked the overdue state", () => {
    // Act
    const result = applyInvoicePayment(target(), invoice("2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"), NOW);

    // Assert
    expect(result).toMatchObject({ status: "ACTIVE", trialEndsAt: null, pastDueSince: null, cancelledAt: null });
  });

  it("should switch to a queued downgrade's plan with the payment that was priced on it", () => {
    // Act
    const result = applyInvoicePayment(
      target({ pendingPlanId: "plan-starter" }),
      invoice("2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"),
      NOW
    );

    // Assert
    expect(result.planId).toBe("plan-starter");
    expect(result.pendingPlanId).toBeNull();
  });

  it("should leave the plan alone when nothing is queued", () => {
    // Act
    const result = applyInvoicePayment(target(), invoice("2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"), NOW);

    // Assert
    expect(result).not.toHaveProperty("planId");
  });
});
