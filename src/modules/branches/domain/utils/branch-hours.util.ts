import { IBranch, IBranchHours, IBranchWithHours } from "../interfaces/branch.interface";

type HoursRow = Pick<IBranchHours, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">;

/** The wall-clock day and minute-of-day in a timezone — what "open now" has to be judged against. */
export function localClock(now: Date, timeZone: string): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dayOfWeek, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * A branch with no schedule at all is always open — hours are opt-in, so every branch that
 * predates them keeps taking orders. Once a schedule exists, a day with no open range is closed.
 * A range is `[opensAt, closesAt)`; "24:00" closes at midnight, and a range past midnight is two entries.
 */
export function isBranchOpen(hours: HoursRow[], timeZone: string, now: Date = new Date()): boolean {
  if (hours.length === 0) return true;

  const { dayOfWeek, minutes } = localClock(now, timeZone);
  return hours.some(
    row => row.dayOfWeek === dayOfWeek && !row.isClosed && toMinutes(row.opensAt) <= minutes && minutes < toMinutes(row.closesAt)
  );
}

/** What an anonymous diner may learn about a branch: where it is, when it opens, whether it is open now. */
export interface IPublicBranch {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  isDefault: boolean;
  isOpenNow: boolean;
  hours: HoursRow[];
}

/** Deliberately leaves out fee overrides and audit columns — internal configuration, not diner-facing. */
export function toPublicBranch(branch: IBranchWithHours, now: Date = new Date()): IPublicBranch {
  const hours = branch.hours.map(({ dayOfWeek, opensAt, closesAt, isClosed }) => ({ dayOfWeek, opensAt, closesAt, isClosed }));
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    address: branch.address,
    phone: branch.phone,
    latitude: branch.latitude,
    longitude: branch.longitude,
    timezone: branch.timezone,
    isDefault: branch.isDefault,
    isOpenNow: branch.isActive && isBranchOpen(hours, branch.timezone, now),
    hours,
  };
}

/** Whether this branch is taking orders right now: active, and inside its hours when it has any. */
export function isTakingOrders(branch: Pick<IBranch, "isActive" | "timezone"> & { hours: HoursRow[] }, now: Date = new Date()): boolean {
  return branch.isActive && isBranchOpen(branch.hours, branch.timezone, now);
}
