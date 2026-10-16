import { courierFeeTransactions } from "../courier-fee-transactions.util";

const run = (id: string, cost: number, day: number, account = "rider-1") => ({
  id,
  supplier: account,
  cost,
  receivedAt: new Date(2026, 0, day),
  orderReference: `#${id}`,
  accountKind: "RIDER" as const,
  accountName: "Ramesh",
});

describe("courierFeeTransactions", () => {
  it("lists a fee left owed as an unpaid payable", () => {
    const [t] = courierFeeTransactions([run("1", 6000, 1)], new Map());
    expect(t).toMatchObject({ type: "DELIVERY_FEE", totalAmount: 6000, paidAmount: 0, outstandingAmount: 6000, paymentStatus: "UNPAID" });
  });

  it("shows a fee paid at settle time as PAID and spreads a later payout oldest run first", () => {
    const rows = courierFeeTransactions([run("1", 6000, 1), run("2", 6000, 2)], new Map([["rider-1", 9000]]));
    expect(rows.find(t => t.source.id === "1")).toMatchObject({ paymentStatus: "PAID" });
    expect(rows.find(t => t.source.id === "2")).toMatchObject({
      paidAmount: 3000,
      outstandingAmount: 3000,
      paymentStatus: "PARTIALLY_PAID",
    });
  });

  it("keeps each courier's payouts to their own runs", () => {
    const rows = courierFeeTransactions([run("1", 6000, 1, "rider-1"), run("2", 6000, 1, "rider-2")], new Map([["rider-1", 6000]]));
    expect(rows.map(t => t.paymentStatus)).toEqual(["PAID", "UNPAID"]);
  });
});
