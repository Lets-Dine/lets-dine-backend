import { IAnalyticsRange, RevenueTrendGranularity, RevenueTrendPeriod } from "../interfaces/analytics.interface";
import { zonedDateParts, zonedOffsetMs } from "./resolve-comparison-range.util";

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface IRevenueTrendSlot {
  index: number;
  /** Bucket key of this period's slot — "2026-01-14" or "2026-01". */
  key: string;
  /** Bucket key of the same slot one period earlier; null when that period is shorter. */
  previousKey: string | null;
}

export interface IRevenueTrendPlan {
  granularity: RevenueTrendGranularity;
  slots: IRevenueTrendSlot[];
  /** Index of today's slot; everything after it has not happened yet. */
  todayIndex: number;
  /** One range spanning the previous period and this one, for a single scan. */
  range: IAnalyticsRange;
}

/**
 * Lays out the chart: which restaurant-local day (or month) each slot is, in this period and the one
 * before it. Weeks start on Sunday, matching `resolveComparisonRanges`. Everything is calendar math on
 * the restaurant's own wall clock; only the outer scan range is turned back into real instants.
 */
export function resolveRevenueTrendPlan(period: RevenueTrendPeriod, timeZone: string, now: Date = new Date()): IRevenueTrendPlan {
  const today = zonedDateParts(now, timeZone);

  if (period === "year") {
    const slots = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      key: monthKey(today.year, i + 1),
      previousKey: monthKey(today.year - 1, i + 1),
    }));
    return {
      granularity: "month",
      slots,
      todayIndex: today.month - 1,
      range: {
        from: zonedMidnight({ year: today.year - 1, month: 1, day: 1 }, timeZone),
        to: zonedMidnight({ year: today.year + 1, month: 1, day: 1 }, timeZone),
      },
    };
  }

  const currentStart: CalendarDate =
    period === "week"
      ? addDays(today, -new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay())
      : { year: today.year, month: today.month, day: 1 };
  const previousStart: CalendarDate =
    period === "week"
      ? addDays(currentStart, -7)
      : { year: today.month === 1 ? today.year - 1 : today.year, month: today.month === 1 ? 12 : today.month - 1, day: 1 };

  const length = period === "week" ? 7 : daysInMonth(currentStart.year, currentStart.month);
  const previousLength = period === "week" ? 7 : daysInMonth(previousStart.year, previousStart.month);

  const slots = Array.from({ length }, (_, i) => ({
    index: i,
    key: dayKey(addDays(currentStart, i)),
    previousKey: i < previousLength ? dayKey(addDays(previousStart, i)) : null,
  }));

  return {
    granularity: "day",
    slots,
    todayIndex: dayDifference(currentStart, today),
    range: { from: zonedMidnight(previousStart, timeZone), to: zonedMidnight(addDays(currentStart, length), timeZone) },
  };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

function dayDifference(from: CalendarDate, to: CalendarDate): number {
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number) => String(value).padStart(2, "0");
const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;
const dayKey = (date: CalendarDate) => `${monthKey(date.year, date.month)}-${pad(date.day)}`;

/** The real instant a restaurant-local calendar date begins. Re-reads the offset at the result so a DST change near midnight lands right. */
function zonedMidnight(date: CalendarDate, timeZone: string): Date {
  const wallClock = Date.UTC(date.year, date.month - 1, date.day);
  const guess = wallClock - zonedOffsetMs(new Date(wallClock), timeZone);
  return new Date(wallClock - zonedOffsetMs(new Date(guess), timeZone));
}
