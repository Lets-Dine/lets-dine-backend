import { PaymentStatus } from "@prisma/client";
import { ICourierRun } from "../utils/courier-fee-transactions.util";
import { ICreditLot } from "../utils/purchase-allocation.util";
import { ITransaction, TransactionType } from "../interfaces/transaction.interface";

export interface ITransactionScope {
  restaurantId: string;
  branchId: string;
}

export interface ITransactionFilter {
  type?: TransactionType;
  from?: Date;
  to?: Date;
  paymentStatus?: PaymentStatus;
  /** Only what is still owed: sales and purchases that are not PAID. Settled rows (expenses, transfers, refunds) never match. */
  outstandingOnly?: boolean;
  category?: string;
  /** A customer id (sales) … */
  customerId?: string;
  /** … or a supplier name (purchases). */
  supplier?: string;
}

/** Rows of one source, newest first, plus how many match in all — the use case merges sources. */
export interface ISourcePage {
  rows: ITransaction[];
  count: number;
}

export abstract class TransactionRepository {
  abstract fetchSales(scope: ITransactionScope, filter: ITransactionFilter, take: number): Promise<ISourcePage>;
  /** Expenses, income and transfers — every cash-book row except the legs a sale refund or supplier payment posts. */
  abstract fetchExpenses(scope: ITransactionScope, filter: ITransactionFilter, take: number): Promise<ISourcePage>;
  abstract fetchRefunds(scope: ITransactionScope, filter: ITransactionFilter, take: number): Promise<ISourcePage>;
  /** Every credit delivery of the branch, with the settled amount per supplier that payments and returns account for. */
  abstract fetchCreditLots(
    scope: ITransactionScope
  ): Promise<{ lots: (ICreditLot & { ingredient: string; unit: string })[]; settled: Map<string, number> }>;
  /** Delivered runs with a courier fee, and what each courier account has been paid out or netted off — keyed by account id. */
  abstract fetchCourierRuns(scope: ITransactionScope): Promise<{ runs: ICourierRun[]; settled: Map<string, number> }>;
  abstract sumReceivables(scope: ITransactionScope, now: Date): Promise<{ outstanding: number; overdue: number; count: number }>;
}
