import { PaymentMethod, RecurrenceFrequency } from "@prisma/client";

/** As stored: dates are plain days. */
export interface IRecurringExpenseRow {
  id: string;
  restaurantId: string;
  branchId: string;
  category: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  frequency: RecurrenceFrequency;
  dueDay: number;
  startsOn: Date;
  handledThrough: Date | null;
  isActive: boolean;
  createdAt: Date;
}

/** As served: days are `YYYY-MM-DD`, with what is waiting on them worked out for today. */
export interface IRecurringExpense {
  id: string;
  category: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  frequency: RecurrenceFrequency;
  dueDay: number;
  startsOn: string;
  isActive: boolean;
  /** Due dates up to today that are neither posted nor skipped, oldest first. Empty while paused. */
  due: string[];
  /** The next date it falls due after today. Null while paused. */
  next: string | null;
}
