/**
 * Nepal's fiscal year runs Shrawan 1 to the end of Ashadh, so it is named after the BS year it starts in ("2083/84").
 * The AD date of Shrawan 1 moves by a day between years and has no formula, so it is a table (read from Hamro Patro's
 * Shrawan pages). Past the last row we throw rather than number invoices into the wrong year — extend the table then.
 */
const SHRAWAN_1: Record<number, string> = {
  2082: "2025-07-17",
  2083: "2026-07-17",
  2084: "2027-07-17",
  2085: "2028-07-16",
  2086: "2029-07-16",
  2087: "2030-07-17",
  2088: "2031-07-18",
  2089: "2032-07-17",
  2090: "2033-07-17",
};

/** The fiscal year `at` falls in, judged on the calendar day in the restaurant's own timezone (1am NPT is still yesterday in UTC). */
export function fiscalYearOf(at: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const years = Object.keys(SHRAWAN_1).map(Number);
  const year = years.filter(y => SHRAWAN_1[y] <= day).pop();
  const nextStart = year === undefined ? undefined : SHRAWAN_1[year + 1];
  if (year === undefined || nextStart === undefined || day >= nextStart) {
    throw new Error(`No fiscal year known for ${day}: extend SHRAWAN_1 in fiscal-year.util.ts`);
  }
  return `${year}/${String(year + 1).slice(2)}`;
}
