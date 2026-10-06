import { ExpenseKind, PaymentMethod } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { ICashClose, IExpense, IPeriodTotals, ISaleLine } from "../interfaces/ledger.interface";

export interface IExpenseCreate {
  restaurantId: string;
  branchId: string;
  kind: ExpenseKind;
  amount: number;
  method: PaymentMethod;
  category: string;
  note: string;
  createdBy: string;
  createdByName: string;
}

export type ICashCloseCreate = Omit<ICashClose, "id">;

export interface ILedgerScope {
  restaurantId: string;
  branchId: string;
}

export abstract class LedgerRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findLastClose(scope: ILedgerScope, options?: { tx?: PrismaTransaction }): Promise<ICashClose | null>;
  /** Payments (sales) and expenses created after `since` (exclusive) up to `until` (inclusive). */
  abstract countCloses(scope: ILedgerScope, options?: { tx?: PrismaTransaction }): Promise<number>;
  abstract deleteClose(id: string, options?: { tx?: PrismaTransaction }): Promise<void>;
  abstract findBranchTimezone(branchId: string): Promise<string>;
  abstract sumPeriod(scope: ILedgerScope, since: Date | null, until: Date, options?: { tx?: PrismaTransaction }): Promise<IPeriodTotals>;
  /** Every payment after `since` with what it was for, oldest first. */
  abstract fetchSales(scope: ILedgerScope, since: Date | null): Promise<ISaleLine[]>;
  abstract fetchAllExpenses(scope: ILedgerScope, since: Date | null): Promise<IExpense[]>;
  abstract createClose(data: ICashCloseCreate, options?: { tx?: PrismaTransaction }): Promise<ICashClose>;
  abstract fetchCloses(scope: ILedgerScope, options?: IPaginationOptions): Promise<PaginatedResponse<ICashClose>>;
  abstract createExpense(data: IExpenseCreate): Promise<IExpense>;
  abstract fetchExpenses(scope: ILedgerScope, since: Date | null, options?: IPaginationOptions): Promise<PaginatedResponse<IExpense>>;
  abstract findExpense(id: string): Promise<IExpense | null>;
  abstract deleteExpense(id: string): Promise<void>;
}
