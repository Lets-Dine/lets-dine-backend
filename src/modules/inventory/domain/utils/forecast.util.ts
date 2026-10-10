export interface IUsage {
  at: Date;
  /** Base units used, positive. */
  quantity: number;
}

/**
 * How much each of the last weeks counts, most recent first. Last week speaks loudest, so a menu
 * change shows up quickly, while the weeks before it keep one odd day (a party, a stock-out) from
 * deciding a whole weekday's forecast. They sum to 1.
 */
export const WEEK_WEIGHTS = [0.5, 0.3, 0.2];
export const HISTORY_WEEKS = WEEK_WEIGHTS.length;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 0 = Sunday … 6 = Saturday, as the branch's clock reads it. */
export function weekdayIn(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * Expected use per weekday: the same weekday in each of the last `HISTORY_WEEKS` weeks (counted back
 * from `now` in whole 7-day blocks, so each weekday occurs once per block), weighted by `WEEK_WEIGHTS`.
 * A Saturday is forecast from the last few Saturdays, not from a weekly average that would hide how
 * much busier it is. Use outside those weeks is ignored.
 */
export function forecastByWeekday(uses: IUsage[], timeZone: string, now: Date): number[] {
  const forecast = Array<number>(7).fill(0);
  for (const use of uses) {
    const weeksAgo = Math.floor((now.getTime() - use.at.getTime()) / WEEK_MS);
    if (weeksAgo < 0 || weeksAgo >= WEEK_WEIGHTS.length) continue;
    forecast[weekdayIn(use.at, timeZone)] += use.quantity * WEEK_WEIGHTS[weeksAgo];
  }
  return forecast;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What to buy so the next `horizonDays` days (starting tomorrow) can be served and the shelf still
 * ends at its warning line: expected use + par − what is on hand. Never negative.
 */
export function quantityToBuy(args: {
  onHand: number;
  parLevel: number;
  byWeekday: number[];
  now: Date;
  horizonDays: number;
  timeZone: string;
}): {
  expectedUse: number;
  toBuy: number;
} {
  let expectedUse = 0;
  for (let day = 1; day <= args.horizonDays; day++) {
    expectedUse += args.byWeekday[weekdayIn(new Date(args.now.getTime() + day * DAY_MS), args.timeZone)];
  }
  expectedUse = Math.round(expectedUse);
  return { expectedUse, toBuy: Math.max(0, expectedUse + args.parLevel - args.onHand) };
}
