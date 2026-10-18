export const RECEIVABLE_BUCKETS = ["notDue", "overdue30", "overdue60", "overdue60plus"] as const;
export type ReceivableBucket = (typeof RECEIVABLE_BUCKETS)[number];

/** One customer's unpaid credit at a branch. `daysOverdue` is for their oldest bill; negative while it is not yet due. */
export interface IReceivable {
  customerId: string;
  name: string;
  phone: string;
  owed: number;
  billCount: number;
  oldestDueAt: Date;
  daysOverdue: number;
  bucket: ReceivableBucket;
  lastRemindedAt: Date | null;
}

export interface IReceivables {
  /** Totals per bucket across every customer, not just the page. */
  buckets: Record<ReceivableBucket, { owed: number; customers: number }>;
  rows: IReceivable[];
  count: number;
}
