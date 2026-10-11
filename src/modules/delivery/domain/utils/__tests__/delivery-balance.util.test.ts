import { DeliverySettlementDirection } from "@prisma/client";
import { DELIVERY_ERROR_MESSAGES } from "../../constants";
import { accountBalance, settlementProblem } from "../delivery-balance.util";

const empty = { cashCollected: 0, feesEarned: 0, collected: 0, paidOut: 0, offsets: 0 };

describe("accountBalance", () => {
  it("is cash held minus fees owed", () => {
    // Arrange
    const totals = { ...empty, cashCollected: 90000, feesEarned: 5000 };

    // Act
    const balance = accountBalance(totals);

    // Assert
    expect(balance).toEqual({ cashHeld: 90000, feesOwed: 5000, net: 85000 });
  });

  it("clears both sides with an offset", () => {
    // Arrange: collected 85,000 and netted off the 5,000 fee in the same act
    const totals = { ...empty, cashCollected: 90000, feesEarned: 5000, collected: 85000, offsets: 5000 };

    // Act
    const balance = accountBalance(totals);

    // Assert
    expect(balance).toEqual({ cashHeld: 0, feesOwed: 0, net: 0 });
  });

  it("goes negative when the branch owes the courier", () => {
    expect(accountBalance({ ...empty, feesEarned: 30000 }).net).toBe(-30000);
  });
});

describe("settlementProblem", () => {
  const balance = { cashHeld: 90000, feesOwed: 5000 };

  it("accepts a collection within the cash held", () => {
    expect(settlementProblem(balance, DeliverySettlementDirection.COLLECT, 85000, 5000)).toBeNull();
  });

  it("refuses to collect more cash than is held, counting the offset", () => {
    expect(settlementProblem(balance, DeliverySettlementDirection.COLLECT, 88000, 5000)).toBe(DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_CASH);
  });

  it("refuses to pay out more than is owed", () => {
    expect(settlementProblem(balance, DeliverySettlementDirection.PAYOUT, 6000, 0)).toBe(DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_FEES);
  });

  it("refuses an offset larger than the fees owed", () => {
    expect(settlementProblem(balance, DeliverySettlementDirection.COLLECT, 1000, 6000)).toBe(DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_FEES);
  });
});
