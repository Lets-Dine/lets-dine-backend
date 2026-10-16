import { allocatePaid } from "../purchase-allocation.util";

const lot = (id: string, cost: number, day: number, supplier = "Fresh Farms") => ({
  id,
  supplier,
  cost,
  receivedAt: new Date(2026, 0, day),
});

describe("allocatePaid", () => {
  it("leaves a credit purchase fully outstanding until something is paid", () => {
    expect(allocatePaid([lot("a", 10000, 1)], new Map()).get("a")).toBe(0);
  });

  it("applies a Rs 4,000 payment to a Rs 10,000 bill, then the remaining Rs 6,000 clears it", () => {
    expect(allocatePaid([lot("a", 10000, 1)], new Map([["fresh farms", 4000]])).get("a")).toBe(4000);
    expect(allocatePaid([lot("a", 10000, 1)], new Map([["fresh farms", 10000]])).get("a")).toBe(10000);
  });

  it("settles the oldest delivery first and carries the rest forward", () => {
    const paid = allocatePaid([lot("new", 5000, 5), lot("old", 3000, 1)], new Map([["fresh farms", 4000]]));
    expect(paid.get("old")).toBe(3000);
    expect(paid.get("new")).toBe(1000);
  });

  it("keeps suppliers apart and ignores case in their names", () => {
    const paid = allocatePaid([lot("a", 1000, 1, "Acme"), lot("b", 1000, 1, "Beta")], new Map([["acme", 1000]]));
    expect(paid.get("a")).toBe(1000);
    expect(paid.get("b")).toBe(0);
  });

  it("never allocates more than the supplier was paid, whatever the lot sizes", () => {
    const paid = allocatePaid([lot("a", 700, 1), lot("b", 700, 2)], new Map([["fresh farms", 900]]));
    expect([...paid.values()].reduce((s, v) => s + v, 0)).toBe(900);
  });
});

import { purchaseTransactions } from "../purchase-transactions.util";

describe("purchaseTransactions", () => {
  const credit = { id: "a", supplier: "Fresh Farms", cost: 10000, receivedAt: new Date(2026, 0, 1), ingredient: "Rice", unit: "kg" };

  it("records a Rs 10,000 credit purchase as unpaid with the whole amount payable", () => {
    const [t] = purchaseTransactions([credit], new Map());
    expect(t).toMatchObject({ type: "PURCHASE", totalAmount: 10000, paidAmount: 0, outstandingAmount: 10000, paymentStatus: "UNPAID" });
  });

  it("moves to PARTIALLY_PAID at Rs 4,000 and PAID at Rs 10,000, with outstanding following", () => {
    expect(purchaseTransactions([credit], new Map([["fresh farms", 4000]]))[0]).toMatchObject({
      paidAmount: 4000,
      outstandingAmount: 6000,
      paymentStatus: "PARTIALLY_PAID",
    });
    expect(purchaseTransactions([credit], new Map([["fresh farms", 10000]]))[0]).toMatchObject({
      outstandingAmount: 0,
      paymentStatus: "PAID",
    });
  });
});
