import { RecurrenceFrequency } from "@prisma/client";
import { dueDates, nextDue } from "../recurrence.util";

const monthly = (dueDay: number, startsOn: string, handledThrough: string | null = null) => ({ frequency: RecurrenceFrequency.MONTHLY, dueDay, startsOn, handledThrough });
const weekly = (dueDay: number, startsOn: string, handledThrough: string | null = null) => ({ frequency: RecurrenceFrequency.WEEKLY, dueDay, startsOn, handledThrough });

describe("dueDates", () => {
  it("lists every month's due date from the start up to today, oldest first", () => {
    expect(dueDates(monthly(5, "2026-08-20"), "2026-10-21")).toEqual(["2026-09-05", "2026-10-05"]);
  });

  it("does not list a due date that falls before the start day, or after today", () => {
    expect(dueDates(monthly(5, "2026-10-10"), "2026-10-21")).toEqual([]);
    expect(dueDates(monthly(25, "2026-10-01"), "2026-10-21")).toEqual([]);
  });

  it("clamps day 31 to the last day of a short month", () => {
    expect(dueDates(monthly(31, "2026-01-01"), "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("carries on from the day after the last one handled", () => {
    expect(dueDates(monthly(5, "2026-01-01", "2026-09-05"), "2026-11-10")).toEqual(["2026-10-05", "2026-11-05"]);
  });

  it("lists each weekday occurrence for a weekly cost", () => {
    // 2026-10-21 is a Wednesday; due Fridays (5)
    expect(dueDates(weekly(5, "2026-10-01"), "2026-10-21")).toEqual(["2026-10-02", "2026-10-09", "2026-10-16"]);
  });

  it("stops at the limit so a long-forgotten cost is not hundreds of rows", () => {
    expect(dueDates(weekly(1, "2020-01-01"), "2026-10-21")).toHaveLength(24);
  });
});

describe("nextDue", () => {
  it("is the next date after today", () => {
    expect(nextDue(monthly(5, "2026-01-01"), "2026-10-21")).toBe("2026-11-05");
    expect(nextDue(monthly(25, "2026-01-01"), "2026-10-21")).toBe("2026-10-25");
    expect(nextDue(weekly(5, "2026-01-01"), "2026-10-21")).toBe("2026-10-23");
  });

  it("is never before the schedule starts", () => {
    expect(nextDue(monthly(5, "2027-01-01"), "2026-10-21")).toBe("2027-01-05");
  });
});
