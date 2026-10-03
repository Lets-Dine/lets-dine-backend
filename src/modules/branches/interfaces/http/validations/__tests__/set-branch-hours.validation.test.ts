import { setBranchHoursSchema } from "../set-branch-hours.validation";

const entry = (opensAt: string, closesAt: string) => ({ hours: [{ dayOfWeek: 1, opensAt, closesAt, isClosed: false }] });

describe("setBranchHoursSchema", () => {
  it("accepts a normal range and a midnight close", () => {
    expect(setBranchHoursSchema.safeParse(entry("10:00", "22:00")).success).toBe(true);
    expect(setBranchHoursSchema.safeParse(entry("18:00", "24:00")).success).toBe(true);
  });

  it("rejects 24:00 as an opening time and malformed times", () => {
    expect(setBranchHoursSchema.safeParse(entry("24:00", "24:00")).success).toBe(false);
    expect(setBranchHoursSchema.safeParse(entry("9:00", "22:00")).success).toBe(false);
    expect(setBranchHoursSchema.safeParse(entry("10:00", "25:00")).success).toBe(false);
  });
});
