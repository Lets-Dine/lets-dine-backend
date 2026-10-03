/**
 * One canonical form for a phone number, so "9841 234 567", "9841-234567" and
 * "+977 9841234567" are the same `Customer`. Digits only; Nepal's 977 country
 * code is dropped. Never store or look up a phone without this.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("977") && digits.length > 10 ? digits.slice(3) : digits;
}
