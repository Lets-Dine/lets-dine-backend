import { IRecurringExpense, IRecurringExpenseRow } from "../interfaces/recurring-expense.interface";
import { IRecurrence, dueDates, nextDue } from "./recurrence.util";

const day = (d: Date) => d.toISOString().slice(0, 10);

export const recurrenceOf = (row: IRecurringExpenseRow): IRecurrence => ({
  frequency: row.frequency,
  dueDay: row.dueDay,
  startsOn: day(row.startsOn),
  handledThrough: row.handledThrough ? day(row.handledThrough) : null,
});

/** The row as the screen reads it, with what is waiting worked out for `today` (the restaurant's own calendar day). */
export function shapeRecurringExpense(row: IRecurringExpenseRow, today: string): IRecurringExpense {
  const recurrence = recurrenceOf(row);
  return {
    id: row.id,
    category: row.category,
    amount: row.amount,
    method: row.method,
    note: row.note,
    frequency: row.frequency,
    dueDay: row.dueDay,
    startsOn: recurrence.startsOn,
    isActive: row.isActive,
    due: row.isActive ? dueDates(recurrence, today) : [],
    next: row.isActive ? nextDue(recurrence, today) : null,
  };
}
