import { isBranchOpen, isTakingOrders, localClock, toPublicBranch } from "../branch-hours.util";

const KTM = "Asia/Kathmandu"; // UTC+05:45, no DST
// 2026-10-05 is a Monday. 06:00Z = 11:45 in Kathmandu.
const monday1145 = new Date("2026-10-05T06:00:00Z");
const day = (dayOfWeek: number, opensAt: string, closesAt: string, isClosed = false) => ({ dayOfWeek, opensAt, closesAt, isClosed });

describe("localClock", () => {
  it("reads the weekday and minute in the branch's own timezone, not UTC", () => {
    expect(localClock(monday1145, KTM)).toEqual({ dayOfWeek: 1, minutes: 11 * 60 + 45 });
  });

  it("rolls over to the next local day when UTC is still the previous one", () => {
    // 20:00Z Sunday is 01:45 Monday in Kathmandu.
    expect(localClock(new Date("2026-10-04T20:00:00Z"), KTM)).toEqual({ dayOfWeek: 1, minutes: 105 });
  });
});

describe("isBranchOpen", () => {
  it("is always open when no hours are configured", () => {
    expect(isBranchOpen([], KTM, monday1145)).toBe(true);
  });

  it("is open inside a range", () => {
    expect(isBranchOpen([day(1, "10:00", "22:00")], KTM, monday1145)).toBe(true);
  });

  it("is closed before opening, and at the exact closing minute", () => {
    expect(isBranchOpen([day(1, "12:00", "22:00")], KTM, monday1145)).toBe(false);
    expect(isBranchOpen([day(1, "10:00", "11:45")], KTM, monday1145)).toBe(false);
  });

  it("is open at the exact opening minute", () => {
    expect(isBranchOpen([day(1, "11:45", "22:00")], KTM, monday1145)).toBe(true);
  });

  it("treats a day with no range as closed once a schedule exists", () => {
    expect(isBranchOpen([day(2, "10:00", "22:00")], KTM, monday1145)).toBe(false);
  });

  it("honours an explicit closed day", () => {
    expect(isBranchOpen([day(1, "10:00", "22:00", true)], KTM, monday1145)).toBe(false);
  });

  it("supports split shifts", () => {
    const hours = [day(1, "10:00", "11:00"), day(1, "11:30", "15:00")];
    expect(isBranchOpen(hours, KTM, monday1145)).toBe(true);
    expect(isBranchOpen(hours, KTM, new Date("2026-10-05T05:30:00Z"))).toBe(false); // 11:15 — between shifts
  });

  it("treats 24:00 as midnight", () => {
    expect(isBranchOpen([day(1, "18:00", "24:00")], KTM, new Date("2026-10-05T17:00:00Z"))).toBe(true); // 22:45
  });
});

describe("isTakingOrders / toPublicBranch", () => {
  const branch = { isActive: true, timezone: KTM, hours: [day(1, "10:00", "22:00")] };

  it("is false for an inactive branch even inside its hours", () => {
    expect(isTakingOrders(branch, monday1145)).toBe(true);
    expect(isTakingOrders({ ...branch, isActive: false }, monday1145)).toBe(false);
  });

  it("exposes only diner-facing fields", () => {
    const full: any = { id: "b", name: "Main", slug: "main", address: "A", phone: null, latitude: 1, longitude: 2, timezone: KTM, isDefault: true, isActive: true, taxRate: 0.5, deliveryFeeAmount: 99, createdBy: "x", hours: [{ id: "h", branchId: "b", ...day(1, "10:00", "22:00") }] };
    const result = toPublicBranch(full, monday1145);
    expect(result.isOpenNow).toBe(true);
    expect(result).not.toHaveProperty("taxRate");
    expect(result).not.toHaveProperty("deliveryFeeAmount");
    expect(result).not.toHaveProperty("createdBy");
    expect(result.hours[0]).not.toHaveProperty("id");
  });
});
