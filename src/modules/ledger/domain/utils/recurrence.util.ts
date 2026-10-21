import { RecurrenceFrequency } from "@prisma/client";

/** Days are plain `YYYY-MM-DD` strings: a due date is a calendar day, with no time zone to get wrong. */
export interface IRecurrence {
  frequency: RecurrenceFrequency;
  /** MONTHLY: day of the month 1–31 (a short month uses its last day). WEEKLY: 0 Sunday – 6 Saturday. */
  dueDay: number;
  startsOn: string;
  handledThrough: string | null;
}

/** A forgotten rent should not turn into hundreds of rows to clear. */
export const MAX_DUE = 24;

const parts = (day: string) => day.split("-").map(Number) as [number, number, number];
const fmt = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** The first day a due date may fall on: the day after the last one handled, and never before the start. */
function firstDay(r: IRecurrence): string {
  const after = r.handledThrough ? addDays(r.handledThrough, 1) : r.startsOn;
  return after > r.startsOn ? after : r.startsOn;
}

/** Due dates from the schedule's first open day up to `until`, oldest first, at most `limit`. */
export function dueDates(r: IRecurrence, until: string, limit = MAX_DUE): string[] {
  const from = firstDay(r);
  const out: string[] = [];
  if (r.frequency === RecurrenceFrequency.WEEKLY) {
    const [y, m, d] = parts(from);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    let day = addDays(from, (r.dueDay - weekday + 7) % 7);
    for (; day <= until && out.length < limit; day = addDays(day, 7)) out.push(day);
    return out;
  }
  let [y, m] = parts(from);
  for (;;) {
    const day = fmt(y, m, Math.min(r.dueDay, daysIn(y, m)));
    if (day > until || out.length >= limit) return out;
    if (day >= from) out.push(day);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
}

/** The first due date after `today` — what to show as "next" once nothing is waiting. Never before the schedule starts. */
export function nextDue(r: IRecurrence, today: string): string {
  const tomorrow = addDays(today, 1);
  const from = firstDay(r) > tomorrow ? firstDay(r) : tomorrow;
  return dueDates({ ...r, startsOn: from, handledThrough: null }, addDays(from, 400), 1)[0] ?? from;
}
