/** A new restaurant starts on this plan's features for the length of its trial. */
export const TRIAL_PLAN_KEY = "growth";
export const TRIAL_DAYS = 30;

/** Emitted when the lifecycle sweep locks a restaurant out (suspended or cancelled), with `{ restaurantId }`. */
export const SUBSCRIPTION_LOCKED_EVENT = "subscription.locked";

/** How far ahead of a period's end the restaurant is reminded to renew. A plan that costs nothing rolls forward at the same moment. */
export const INVOICE_LEAD_DAYS = 7;

/** An annual price is this many months' worth — two months free. Applied to purchased add-ons too, to match the plan's own annual price. */
export const ANNUAL_MONTHS_CHARGED = 10;

/**
 * When the daily billing cycle runs. 02:00 local time: restaurants are closed, so a
 * subscription tipping into RESTRICTED never lands mid-service. Both are overridable
 * (`BILLING_CRON`, `BILLING_CRON_TIMEZONE`).
 */
export const DEFAULT_BILLING_CRON = "0 2 * * *";
export const DEFAULT_BILLING_CRON_TIMEZONE = "Asia/Kathmandu";
