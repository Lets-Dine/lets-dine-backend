export * from "./messages/error-message";
export * from "./messages/success-message";

/** A program nobody has configured: off, and one point for every Rs 10 once it is switched on. */
export const DEFAULT_LOYALTY_PROGRAM = { enabled: false, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 0 };
