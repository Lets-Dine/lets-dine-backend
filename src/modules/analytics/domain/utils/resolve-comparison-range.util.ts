import { ComparisonPeriod, IAnalyticsRange } from "../interfaces/analytics.interface";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface ZonedDate {
  year: number;
  month: number;
  day: number;
}

/**
 * §31 — shared by every current-vs-previous analytics comparison (revenue,
 * orders, …). "current" runs from the period's start up to now; "previous"
 * is the *entire* prior period (its real length, not clipped to how much of
 * today has elapsed), which is exactly the span ending where "current"
 * begins. Boundaries are the restaurant's own configured timezone
 * (`Restaurant.timezone`, e.g. "Asia/Kathmandu") — a business's day, week
 * and month start where its own clock says they do, the same for every
 * viewer regardless of which timezone their own browser happens to be in.
 */
export function resolveComparisonRanges(
  period: ComparisonPeriod,
  timeZone: string,
  now: Date = new Date()
): { current: IAnalyticsRange; previous: IAnalyticsRange } {
  const currentStart = periodStart(period, now, timeZone);
  const previousStart = priorPeriodStart(period, currentStart, timeZone);

  return {
    current: { from: currentStart, to: now },
    // The full prior period, right up to the instant "current" takes over.
    previous: { from: previousStart, to: currentStart },
  };
}

export function comparisonPercentageDiff(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function periodStart(period: ComparisonPeriod, now: Date, timeZone: string): Date {
  const todayStart = startOfZonedDay(now, timeZone);

  switch (period) {
    case "today":
      return todayStart;
    case "week":
      // Sunday-start week.
      return new Date(todayStart.getTime() - zonedWeekday(todayStart, timeZone) * DAY_MS);
    case "month":
      return startOfZonedMonth(now, timeZone);
  }
}

function priorPeriodStart(period: ComparisonPeriod, currentStart: Date, timeZone: string): Date {
  switch (period) {
    case "today":
      return new Date(currentStart.getTime() - DAY_MS);
    case "week":
      return new Date(currentStart.getTime() - WEEK_MS);
    case "month":
      return startOfPriorZonedMonth(currentStart, timeZone);
  }
}

/* ── Timezone-aware calendar math ──────────────────────────────────
   No date library in this project yet — `Intl.DateTimeFormat` already
   knows every IANA zone's offset (DST included), so it is enough to read
   an instant's wall-clock parts in that zone and invert the offset to
   build a new instant back out of calendar numbers. */

function zonedDateParts(instant: Date, timeZone: string): ZonedDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** How far `timeZone`'s wall clock sits ahead of UTC at `instant`, in ms. */
function zonedOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const asIfUTC = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asIfUTC - instant.getTime();
}

/** Midnight of `instant`'s own calendar day in `timeZone`, as a real UTC instant. */
function startOfZonedDay(instant: Date, timeZone: string): Date {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  const offset = zonedOffsetMs(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day) - offset);
}

/** 0 = Sunday .. 6 = Saturday, for the calendar date `instant` (already zone-midnight) falls on. */
function zonedWeekday(instant: Date, timeZone: string): number {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function startOfZonedMonth(instant: Date, timeZone: string): Date {
  const { year, month } = zonedDateParts(instant, timeZone);
  const offset = zonedOffsetMs(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, 1) - offset);
}

function startOfPriorZonedMonth(currentMonthStart: Date, timeZone: string): Date {
  const { year, month } = zonedDateParts(currentMonthStart, timeZone);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const offset = zonedOffsetMs(currentMonthStart, timeZone);
  return new Date(Date.UTC(prevYear, prevMonth - 1, 1) - offset);
}
