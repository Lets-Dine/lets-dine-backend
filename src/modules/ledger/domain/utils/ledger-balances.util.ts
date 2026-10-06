import { IPeriodTotals } from "../interfaces/ledger.interface";

export const EMPTY_TOTALS: IPeriodTotals = {
  cashSales: 0,
  cardSales: 0,
  cashExpenses: 0,
  cardExpenses: 0,
  cashIncome: 0,
  cardIncome: 0,
  deposits: 0,
  withdrawals: 0,
};

/**
 * What the drawer and the bank should hold after a period. A deposit moves cash into the bank and a
 * withdrawal the other way, so neither is income or spend — they only shift money between the two.
 */
export function expectedBalances(opening: number, bankOpening: number, t: IPeriodTotals): { cash: number; bank: number } {
  return {
    cash: opening + t.cashSales + t.cashIncome - t.cashExpenses - t.deposits + t.withdrawals,
    bank: bankOpening + t.cardSales + t.cardIncome - t.cardExpenses + t.deposits - t.withdrawals,
  };
}
