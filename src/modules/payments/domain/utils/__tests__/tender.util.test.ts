import { openingTenders, outstandingOf, statusOf } from "../tender.util";

describe("tender util", () => {
  it("derives UNPAID / PARTIALLY_PAID / PAID from what is collected against the total", () => {
    expect(statusOf(2000, 0)).toBe("UNPAID");
    expect(statusOf(2000, 1000)).toBe("PARTIALLY_PAID");
    expect(statusOf(2000, 2000)).toBe("PAID");
  });

  it("reports outstanding as total minus paid and never goes negative", () => {
    expect(outstandingOf(2000, 1000)).toBe(1000);
    expect(outstandingOf(2000, 2500)).toBe(0);
  });

  it("opens a bill paid in full by one method as a single tender (the usual till flow)", () => {
    expect(openingTenders(2000, "CASH")).toEqual({ tenders: [{ method: "CASH", amount: 2000 }], paidAmount: 2000, paymentStatus: "PAID" });
  });

  it("opens a split bill: Rs 1,000 cash and Rs 1,000 QR on Rs 2,000", () => {
    const opening = openingTenders(2000, "CASH", [
      { method: "CASH", amount: 1000 },
      { method: "QR", amount: 1000 },
    ]);
    expect(opening.paidAmount).toBe(2000);
    expect(opening.paymentStatus).toBe("PAID");
    expect(opening.tenders).toHaveLength(2);
  });

  it("opens a credit sale with no tenders as UNPAID", () => {
    expect(openingTenders(2000, "CASH", [])).toEqual({ tenders: [], paidAmount: 0, paymentStatus: "UNPAID" });
  });

  it("adds no tender for a zero bill", () => {
    expect(openingTenders(0, "CASH").tenders).toEqual([]);
  });
});
