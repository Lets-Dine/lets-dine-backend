import { DeliverySettlementDirection, DeliverySettlementMethod, ExpenseKind, PaymentMethod } from "@prisma/client";
import { ledgerPostingsFor } from "../delivery-ledger.util";

/** What the drawer or bank changes by: income in, expense out. */
const balanceChange = (postings: ReturnType<typeof ledgerPostingsFor>, method: PaymentMethod) =>
  postings.filter(p => p.method === method).reduce((sum, p) => sum + (p.kind === ExpenseKind.INCOME ? p.amount : -p.amount), 0);

describe("ledgerPostingsFor", () => {
  it("posts a plain collection as cash income", () => {
    // Arrange / Act
    const postings = ledgerPostingsFor({
      direction: DeliverySettlementDirection.COLLECT,
      amount: 85000,
      offset: 0,
      method: DeliverySettlementMethod.CASH,
    });

    // Assert
    expect(postings).toEqual([{ kind: ExpenseKind.INCOME, amount: 85000, method: PaymentMethod.CASH, category: "Delivery cash" }]);
  });

  it("posts a plain payout as an expense", () => {
    const postings = ledgerPostingsFor({
      direction: DeliverySettlementDirection.PAYOUT,
      amount: 20000,
      offset: 0,
      method: DeliverySettlementMethod.CASH,
    });

    expect(postings).toEqual([{ kind: ExpenseKind.EXPENSE, amount: 20000, method: PaymentMethod.CASH, category: "Delivery fees" }]);
  });

  it("shows the gross cash and the netted fee, moving the drawer only by what changed hands", () => {
    // Arrange / Act
    const postings = ledgerPostingsFor({
      direction: DeliverySettlementDirection.COLLECT,
      amount: 85000,
      offset: 5000,
      method: DeliverySettlementMethod.CASH,
    });

    // Assert
    expect(postings).toEqual([
      { kind: ExpenseKind.INCOME, amount: 90000, method: PaymentMethod.CASH, category: "Delivery cash" },
      { kind: ExpenseKind.EXPENSE, amount: 5000, method: PaymentMethod.CASH, category: "Delivery fees" },
    ]);
    expect(balanceChange(postings, PaymentMethod.CASH)).toBe(85000);
  });

  it("shows the gross fees and the netted cash on a payout, moving the drawer down by what was paid", () => {
    const postings = ledgerPostingsFor({
      direction: DeliverySettlementDirection.PAYOUT,
      amount: 20000,
      offset: 4000,
      method: DeliverySettlementMethod.CASH,
    });

    expect(postings).toEqual([
      { kind: ExpenseKind.INCOME, amount: 4000, method: PaymentMethod.CASH, category: "Delivery cash" },
      { kind: ExpenseKind.EXPENSE, amount: 24000, method: PaymentMethod.CASH, category: "Delivery fees" },
    ]);
    expect(balanceChange(postings, PaymentMethod.CASH)).toBe(-20000);
  });

  it("lands a bank or wallet transfer on the bank side only", () => {
    const postings = ledgerPostingsFor({
      direction: DeliverySettlementDirection.COLLECT,
      amount: 87400,
      offset: 12600,
      method: DeliverySettlementMethod.BANK,
    });

    expect(postings.every(p => p.method === PaymentMethod.CARD)).toBe(true);
    expect(balanceChange(postings, PaymentMethod.CARD)).toBe(87400);
    expect(balanceChange(postings, PaymentMethod.CASH)).toBe(0);
  });
});
