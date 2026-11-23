import { fiscalYearOf } from "../fiscal-year.util";

describe("fiscalYearOf", () => {
  it("switches on Shrawan 1 in Kathmandu time, not UTC", () => {
    // 2026-07-16 20:00 UTC is 01:45 on 17 July in Kathmandu: already Shrawan 1.
    expect(fiscalYearOf(new Date("2026-07-16T20:00:00Z"), "Asia/Kathmandu")).toBe("2083/84");
    expect(fiscalYearOf(new Date("2026-07-16T17:00:00Z"), "Asia/Kathmandu")).toBe("2082/83");
    expect(fiscalYearOf(new Date("2026-11-23T05:00:00Z"), "Asia/Kathmandu")).toBe("2083/84");
  });

  it("refuses a date outside the table", () => {
    expect(() => fiscalYearOf(new Date("2025-01-01T00:00:00Z"), "Asia/Kathmandu")).toThrow();
    expect(() => fiscalYearOf(new Date("2034-08-01T00:00:00Z"), "Asia/Kathmandu")).toThrow();
  });
});
