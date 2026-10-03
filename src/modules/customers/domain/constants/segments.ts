/**
 * The segment thresholds the customers list classifies by. Applied in SQL (see
 * `CustomerRepositoryImpl.fetchAll`) so a segment can be filtered and counted without
 * pulling every customer into the app.
 */
export const NEW_WITHIN_DAYS = 30;
export const LAPSED_AFTER_DAYS = 45;
export const REGULAR_MIN_VISITS = 6;
/** How many weeks the list's visit rhythm covers. */
export const RHYTHM_WEEKS = 10;
