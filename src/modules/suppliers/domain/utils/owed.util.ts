/** What a supplier is still owed: credit deliveries less payments, never below zero. */
export const owedOf = (credit: number, paid: number): number => Math.max(0, credit - paid);
