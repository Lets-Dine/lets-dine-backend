import { BadRequestException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { RecurringExpenseRepository } from "../../../domain/repositories/recurring-expense.repository";
import { UpdateRecurringExpenseUsecase } from "../update-recurring-expense.usecase";

const authUser = buildAuthEntity();

// Rent due on the 5th; October already posted.
const row = {
  id: "rec-1",
  restaurantId: authUser.restaurantId,
  branchId: authUser.branchId,
  category: "Rent",
  amount: 50_000,
  method: "CARD",
  note: "",
  frequency: "MONTHLY",
  dueDay: 5,
  startsOn: new Date("2026-01-01"),
  handledThrough: new Date("2026-10-05"),
  isActive: true,
  createdAt: new Date("2026-01-01"),
};

function build(found: unknown = row) {
  const recurring = { findById: jest.fn().mockResolvedValue(found), update: jest.fn().mockImplementation(async (_id: string, data: object) => ({ ...(found as object), ...data })) };
  const restaurants = { findById: jest.fn().mockResolvedValue({ timezone: "UTC" }) };
  return { recurring, usecase: new UpdateRecurringExpenseUsecase(recurring as unknown as RecurringExpenseRepository, restaurants as unknown as RestaurantRepository) };
}

describe("UpdateRecurringExpenseUsecase", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-10-21T10:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("starts a changed day from today, so October's rent is not due a second time", async () => {
    const { recurring, usecase } = build();

    const result = await usecase.execute("rec-1", { dueDay: 25 }, authUser);

    expect(recurring.update).toHaveBeenCalledWith("rec-1", expect.objectContaining({ dueDay: 25, handledThrough: new Date("2026-10-20") }));
    expect(result.due).toEqual(["2026-10-25"].filter(d => d <= "2026-10-21")); // nothing: the 25th is still ahead
    expect(result.next).toBe("2026-10-25");
  });

  it("does not touch the cursor when only the amount changes", async () => {
    const { recurring, usecase } = build();

    await usecase.execute("rec-1", { amount: 60_000 }, authUser);

    expect(recurring.update).toHaveBeenCalledWith("rec-1", { amount: 60_000 });
  });

  it("does not bring back the dates missed while paused when it is resumed", async () => {
    const { recurring, usecase } = build({ ...row, isActive: false, handledThrough: new Date("2026-03-05") });

    const result = await usecase.execute("rec-1", { isActive: true }, authUser);

    expect(recurring.update).toHaveBeenCalledWith("rec-1", expect.objectContaining({ isActive: true, handledThrough: new Date("2026-10-20") }));
    expect(result.due).toEqual([]);
  });

  it("rejects a weekday above 6 for a weekly cost", async () => {
    const { usecase } = build();

    await expect(usecase.execute("rec-1", { frequency: "WEEKLY", dueDay: 12 }, authUser)).rejects.toBeInstanceOf(BadRequestException);
  });
});
