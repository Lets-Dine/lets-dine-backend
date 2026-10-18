import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/prisma";
import { IReceivable, IReceivables, RECEIVABLE_BUCKETS, ReceivableBucket } from "../receivables.interface";

interface Row extends Omit<IReceivable, "owed" | "billCount" | "daysOverdue"> {
  owed: number;
  billCount: number;
  daysOverdue: number;
  total: number;
}

const ORDER: Record<string, Prisma.Sql> = {
  owed: Prisma.sql`owed DESC`,
  oldest: Prisma.sql`days_overdue DESC`,
  name: Prisma.sql`lower(name) ASC`,
};

@Injectable()
export class ReceivableRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One pass over unpaid and part-paid bills that belong to a customer, collapsed to a row per customer.
   * A bill with no due date counts as due the day it was made. Timestamps hold UTC, so `now()` is converted
   * before comparing. Bucket totals come from the same CTE, so they cover every customer, not just this page.
   */
  async list(q: { restaurantId: string; branchId: string; bucket?: ReceivableBucket; sortBy: string; offset: number; limit: number }): Promise<IReceivables> {
    const byBucket = q.bucket ? Prisma.sql`WHERE bucket = ${q.bucket}` : Prisma.empty;
    const base = Prisma.sql`
      WITH owing AS (
        SELECT
          p.customer_id,
          SUM(p.total - p.paid_amount)::float8 AS owed,
          COUNT(*)::int                        AS bill_count,
          MIN(COALESCE(p.due_date, p.created_at)) AS oldest_due_at
        FROM payments p
        WHERE p.restaurant_id = ${q.restaurantId}::uuid
          AND p.branch_id = ${q.branchId}::uuid
          AND p.customer_id IS NOT NULL
          AND p.payment_status <> 'PAID'
          AND p.total > p.paid_amount
        GROUP BY p.customer_id
      ),
      shaped AS (
        SELECT
          c.id AS customer_id, c.name, c.phone, o.owed, o.bill_count, o.oldest_due_at,
          FLOOR(EXTRACT(EPOCH FROM timezone('UTC', now()) - o.oldest_due_at) / 86400)::int AS days_overdue,
          (SELECT MAX(r.created_at) FROM receivable_reminders r
            WHERE r.restaurant_id = ${q.restaurantId}::uuid AND r.customer_id = c.id) AS last_reminded_at
        FROM owing o
        JOIN customers c ON c.id = o.customer_id
      ),
      listed AS (
        SELECT *, CASE
          WHEN days_overdue < 0  THEN 'notDue'
          WHEN days_overdue <= 30 THEN 'overdue30'
          WHEN days_overdue <= 60 THEN 'overdue60'
          ELSE 'overdue60plus' END AS bucket
        FROM shaped
      )`;

    const [rows, sums] = await Promise.all([
      this.prisma.$queryRaw<Row[]>`
        ${base}
        SELECT customer_id AS "customerId", name, phone, owed, bill_count AS "billCount", oldest_due_at AS "oldestDueAt",
               days_overdue AS "daysOverdue", bucket, last_reminded_at AS "lastRemindedAt", (COUNT(*) OVER ())::int AS total
        FROM listed ${byBucket}
        ORDER BY ${ORDER[q.sortBy] ?? ORDER.owed}, customer_id
        LIMIT ${q.limit} OFFSET ${q.offset}`,
      this.prisma.$queryRaw<{ bucket: ReceivableBucket; owed: number; customers: number }[]>`
        ${base}
        SELECT bucket, SUM(owed)::float8 AS owed, COUNT(*)::int AS customers FROM listed GROUP BY bucket`,
    ]);

    const buckets = Object.fromEntries(RECEIVABLE_BUCKETS.map(b => [b, { owed: 0, customers: 0 }])) as IReceivables["buckets"];
    for (const s of sums) buckets[s.bucket] = { owed: s.owed, customers: s.customers };
    // The window count rides on the rows; past the last page there are none, so fall back to the bucket sums.
    const count = rows[0]?.total ?? (q.bucket ? buckets[q.bucket].customers : Object.values(buckets).reduce((n, b) => n + b.customers, 0));
    return { buckets, rows: rows.map(({ total: _t, ...r }) => r), count };
  }

  /** What they owe right now at the branch, so the log records the real figure rather than trusting the client. */
  async owedBy(restaurantId: string, branchId: string, customerId: string): Promise<number> {
    const [r] = await this.prisma.$queryRaw<{ owed: number | null }[]>`
      SELECT SUM(total - paid_amount)::float8 AS owed FROM payments
      WHERE restaurant_id = ${restaurantId}::uuid AND branch_id = ${branchId}::uuid AND customer_id = ${customerId}::uuid
        AND payment_status <> 'PAID' AND total > paid_amount`;
    return r?.owed ?? 0;
  }

  addReminder(data: { restaurantId: string; customerId: string; amount: number; createdBy: string; createdByName: string }) {
    return this.prisma.receivableReminder.create({ data });
  }
}
