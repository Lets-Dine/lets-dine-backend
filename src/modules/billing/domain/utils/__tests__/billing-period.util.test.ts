import { addInterval } from "../billing-period.util";

describe("addInterval", () => {
  it.each([
    ["2026-03-01T00:00:00.000Z", "MONTHLY", "2026-04-01T00:00:00.000Z"],
    ["2026-03-15T09:30:00.000Z", "MONTHLY", "2026-04-15T09:30:00.000Z"],
    ["2026-12-10T00:00:00.000Z", "MONTHLY", "2027-01-10T00:00:00.000Z"],
    ["2026-03-01T00:00:00.000Z", "ANNUAL", "2027-03-01T00:00:00.000Z"],
  ] as const)("should add one %2$s interval to %s", (from, interval, expected) => {
    // Act & Assert
    expect(addInterval(new Date(from), interval)).toEqual(new Date(expected));
  });

  it.each([
    ["Jan 31 -> Feb 28 in a normal year", "2026-01-31T00:00:00.000Z", "2026-02-28T00:00:00.000Z"],
    ["Jan 31 -> Feb 29 in a leap year", "2028-01-31T00:00:00.000Z", "2028-02-29T00:00:00.000Z"],
    ["Mar 31 -> Apr 30", "2026-03-31T00:00:00.000Z", "2026-04-30T00:00:00.000Z"],
  ])("should clamp the day instead of rolling into the next month: %s", (_name, from, expected) => {
    // Act & Assert
    expect(addInterval(new Date(from), "MONTHLY")).toEqual(new Date(expected));
  });

  it("should clamp Feb 29 to Feb 28 when an annual interval lands in a non-leap year", () => {
    // Act & Assert
    expect(addInterval(new Date("2028-02-29T00:00:00.000Z"), "ANNUAL")).toEqual(new Date("2029-02-28T00:00:00.000Z"));
  });
});
