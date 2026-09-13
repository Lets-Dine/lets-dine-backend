import { IRestaurant } from "../interfaces/restaurant.interface";

const TRACKED_FIELDS: (keyof IRestaurant)[] = [
  "name",
  "tagline",
  "description",
  "coverImageUrl",
  "currency",
  "timezone",
  "serviceChargeRate",
  "taxRate",
  "isActive",
];

/**
 * §51 — the audit entry has to say what actually changed, so build the
 * before → after line here rather than logging "settings updated" and nothing.
 */
export function describeSettingsChange(before: IRestaurant, after: IRestaurant): string {
  return TRACKED_FIELDS.filter(field => before[field] !== after[field])
    .map(field => `${field}: ${format(before[field])} → ${format(after[field])}`)
    .join(", ");
}

function format(value: IRestaurant[keyof IRestaurant]): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
