import { ExpenseKind, PaymentMethod } from "@prisma/client";

export interface IExpense {
  id: string;
  kind: ExpenseKind;
  restaurantId: string;
  branchId: string;
  amount: number;
  method: PaymentMethod;
  category: string;
  note: string;
  createdAt: Date;
  createdBy: string | null;
  createdByName: string | null;
}

export interface ICashClose {
  id: string;
  restaurantId: string;
  branchId: string;
  opening: number;
  cashSales: number;
  cardSales: number;
  cashExpenses: number;
  cardExpenses: number;
  cashIncome: number;
  cardIncome: number;
  deposits: number;
  withdrawals: number;
  bankOpening: number;
  bankExpected: number;
  bankCounted: number;
  bankVariance: number;
  closingExpected: number;
  closingCounted: number;
  variance: number;
  note: string;
  closedAt: Date;
  closedBy: string | null;
  closedByName: string | null;
}

/** Sales and expenses of one period, split by how the money moved. Minor units. */
export interface IPeriodTotals {
  cashSales: number;
  cardSales: number;
  cashExpenses: number;
  cardExpenses: number;
  /** Money in that is not a sale. */
  cashIncome: number;
  cardIncome: number;
  /** Cash moved into the bank, and bank money moved into the drawer. */
  deposits: number;
  withdrawals: number;
}

/** The open period: what the drawer should hold right now, given everything recorded since the last close. */
export interface ILedgerSummary extends IPeriodTotals {
  /** True until the branch has recorded its opening float — the first close sets it. */
  needsOpening: boolean;
  periodStart: Date | null;
  /** A real close (not the opening setup) already happened today in the branch's timezone — closing again is refused. */
  closedToday: boolean;
  /** The latest close is a real one, so it can be taken back; the opening setup never can. */
  canReopen: boolean;
  opening: number;
  closingExpected: number;
  /** Off-cash balance at the start of the period, and what it should hold now. */
  bankOpening: number;
  bankExpected: number;
}

/** One line of the open period's tape, oldest first. */
export interface ILedgerEntry {
  id: string;
  kind: "opening" | "sale" | "income" | "expense" | "transfer";
  at: Date;
  amount: number;
  method: PaymentMethod;
  /** How the line moved each balance — the tape reads its running drawer and bank from these. */
  cashDelta: number;
  bankDelta: number;
  /** What it was: the dishes sold, the expense category, or "Day opened". */
  label: string;
  /** Where or why: the table, delivery, the expense note and who entered it. */
  detail: string;
}

/** A settled payment reduced to what the tape shows. */
export interface ISaleLine {
  id: string;
  createdAt: Date;
  total: number;
  method: PaymentMethod;
  /** Null for a delivery order. */
  tableName: string | null;
  items: { dishNameSnapshot: string; quantity: number }[];
}
