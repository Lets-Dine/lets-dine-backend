import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { LEDGER_ERROR_MESSAGES } from "../../../domain/constants";
import { LedgerRepository } from "../../../domain/repositories/ledger.repository";
import { RecurringExpenseRepository } from "../../../domain/repositories/recurring-expense.repository";
import { SettleRecurringExpenseUsecase } from "../settle-recurring-expense.usecase";

const authUser = buildAuthEntity();

// "Today" is 2026-10-21 in UTC; rent is due on the 5th, started in August, nothing handled yet — so Aug, Sep and Oct are waiting.
const row = {
  id: "rec-1",
  restaurantId: authUser.restaurantId,
  branchId: authUser.branchId,
  category: "Rent",
  amount: 50_000,
  method: "CARD",
  note: "Shop",
  frequency: "MONTHLY",
  dueDay: 5,
  startsOn: new Date("2026-08-01"),
  handledThrough: null as Date | null,
  isActive: true,
  createdAt: new Date("2026-08-01"),
};

function build(over: { row?: unknown; advanced?: boolean } = {}) {
  const recurring = {
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    findById: jest.fn().mockResolvedValue("row" in over ? over.row : row),
    advance: jest.fn().mockResolvedValue(over.advanced ?? true),
  };
  const ledger = { createExpense: jest.fn() };
  const restaurants = { findById: jest.fn().mockResolvedValue({ timezone: "UTC" }) };
  const usecase = new SettleRecurringExpenseUsecase(
    recurring as unknown as RecurringExpenseRepository,
    ledger as unknown as LedgerRepository,
    restaurants as unknown as RestaurantRepository
  );
  return { recurring, ledger, usecase };
}

describe("SettleRecurringExpenseUsecase", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-21T10:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("posts the oldest waiting date to the cash book and moves the cursor past it", async () => {
    const { recurring, ledger, usecase } = build();

    await usecase.execute("rec-1", { dueOn: "2026-08-05", action: "post" }, authUser);

    expect(recurring.advance).toHaveBeenCalledWith("rec-1", null, new Date("2026-08-05"), expect.anything());
    expect(ledger.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "EXPENSE", amount: 50_000, method: "CARD", category: "Rent", note: "Recurring · due 2026-08-05 · Shop", recurringExpenseId: "rec-1", recurringDueOn: new Date("2026-08-05") }),
      expect.anything()
    );
  });

  it("skips a date without touching the cash book", async () => {
    const { recurring, ledger, usecase } = build();

    await usecase.execute("rec-1", { dueOn: "2026-08-05", action: "skip" }, authUser);

    expect(recurring.advance).toHaveBeenCalled();
    expect(ledger.createExpense).not.toHaveBeenCalled();
  });

  it("skips every waiting date at once by moving the cursor to today", async () => {
    const { recurring, ledger, usecase } = build();

    await usecase.execute("rec-1", { dueOn: "2026-08-05", action: "skip-all" }, authUser);

    expect(recurring.advance).toHaveBeenCalledWith("rec-1", null, new Date("2026-10-21"), expect.anything());
    expect(ledger.createExpense).not.toHaveBeenCalled();
  });

  it("refuses a later date while an earlier one is still waiting", async () => {
    const { ledger, usecase } = build();

    await expect(usecase.execute("rec-1", { dueOn: "2026-10-05", action: "post" }, authUser)).rejects.toMatchObject({
      message: LEDGER_ERROR_MESSAGES.RECURRING_NOT_DUE.message,
    });
    expect(ledger.createExpense).not.toHaveBeenCalled();
  });

  it("posts once when the same date is tapped twice: the second move of the cursor finds it already moved", async () => {
    const { ledger, usecase } = build({ advanced: false });

    await expect(usecase.execute("rec-1", { dueOn: "2026-08-05", action: "post" }, authUser)).rejects.toMatchObject({
      message: LEDGER_ERROR_MESSAGES.RECURRING_NOT_DUE.message,
    });
    expect(ledger.createExpense).not.toHaveBeenCalled();
  });

  it("refuses anything on a paused cost", async () => {
    const { usecase } = build({ row: { ...row, isActive: false } });

    await expect(usecase.execute("rec-1", { dueOn: "2026-08-05", action: "post" }, authUser)).rejects.toBeDefined();
  });

  it("does not find another branch's cost", async () => {
    const { usecase } = build({ row: { ...row, branchId: "11111111-1111-4111-8111-111111111111" } });

    await expect(usecase.execute("rec-1", { dueOn: "2026-08-05", action: "post" }, authUser)).rejects.toMatchObject({
      message: LEDGER_ERROR_MESSAGES.RECURRING_NOT_FOUND.message,
    });
  });
});
