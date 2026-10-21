import { PaymentMethod, RecurrenceFrequency } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IRecurringExpenseRow } from "../interfaces/recurring-expense.interface";

export interface IRecurringExpenseCreate {
  restaurantId: string;
  branchId: string;
  category: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  frequency: RecurrenceFrequency;
  dueDay: number;
  startsOn: Date;
  createdBy: string;
}

export type IRecurringExpenseUpdate = Partial<Omit<IRecurringExpenseCreate, "restaurantId" | "branchId" | "createdBy"> & { isActive: boolean; handledThrough: Date | null }>;

export abstract class RecurringExpenseRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findForBranch(restaurantId: string, branchId: string): Promise<IRecurringExpenseRow[]>;
  abstract findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IRecurringExpenseRow | null>;
  abstract create(data: IRecurringExpenseCreate): Promise<IRecurringExpenseRow>;
  abstract update(id: string, data: IRecurringExpenseUpdate): Promise<IRecurringExpenseRow>;
  abstract delete(id: string): Promise<void>;
  /** Moves the cursor to `to` only if it still sits at `from`, so two taps on one due date handle it once. False when it had already moved. */
  abstract advance(id: string, from: Date | null, to: Date, tx: PrismaTransaction): Promise<boolean>;
}
