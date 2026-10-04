import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService } from "../../../../common/prisma";
import { ITenantListItem, ITenantViewCounts } from "../../domain/interfaces/billing.interface";
import { ITenantsFetchQuery, TenantRepository, TenantSort, TenantView } from "../../domain/repositories/tenant.repository";
import { planLimitsSchema } from "../../interfaces/http/validations/plan-config.validation";

const WEEKS = 8;

/** The statuses that are being billed — the same set the console treats as "paying". */
const BILLING = Prisma.sql`s.status IN ('ACTIVE', 'PAST_DUE', 'RESTRICTED')`;

/** A trial in its last days is as pressing as an overdue invoice, hence "attention". */
const VIEW_PREDICATE: Record<TenantView, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  active: BILLING,
  trial: Prisma.sql`s.status = 'TRIAL'`,
  attention: Prisma.sql`(s.status IN ('PAST_DUE', 'RESTRICTED') OR (s.status = 'TRIAL' AND s.trial_ends_at < timezone('UTC', now()) + interval '4 days'))`,
  closed: Prisma.sql`s.status IN ('SUSPENDED', 'CANCELLED')`,
};

/** Whitelisted `ORDER BY` — `sortBy` picks a key, user text never reaches the SQL. `id` breaks ties so paging is stable. */
const ORDER_BY: Record<TenantSort, { column: Prisma.Sql; defaultDir: "asc" | "desc" }> = {
  active: { column: Prisma.sql`l.last_active_at`, defaultDir: "desc" },
  newest: { column: Prisma.sql`l.created_at`, defaultDir: "desc" },
  name: { column: Prisma.sql`lower(l.name)`, defaultDir: "asc" },
  revenue: { column: Prisma.sql`l.mrr`, defaultDir: "desc" },
};

/** `%`, `_` and `\` are LIKE wildcards — a search for "50%" must not match everything. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
  planKey: string;
  planName: string;
  limits: unknown;
  status: ITenantListItem["status"];
  interval: ITenantListItem["interval"];
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  pastDueSince: Date | null;
  extraBranches: number;
  extraSeats: number;
  mrr: number;
  branches: number;
  seats: number;
  ordersThisMonth: number | null;
  ordersLastMonth: number | null;
  total: number;
}

@Injectable()
class TenantRepositoryImpl implements TenantRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Two round trips, however many restaurants there are:
   *
   *  1. `listed` joins subscription and plan (one row each per restaurant) and probes, per
   *     restaurant, its owner and its newest order. Both probes are index lookups —
   *     `restaurant_members(restaurant_id, user_id)` and `orders(restaurant_id, created_at DESC)` —
   *     not scans, so listing every restaurant stays cheap. MRR is computed here so it can be sorted on.
   *  2. `paged` filters, sorts and cuts the page *before* anything per-row and expensive runs: the
   *     branch/seat counts and the two usage-counter reads are correlated subqueries evaluated only
   *     for the page's rows. `COUNT(*) OVER()` returns the filtered total beside the page.
   *
   * The 8-week order rhythm is a separate query keyed by the page's ids — a bounded range scan on
   * `orders(restaurant_id, created_at)` — rather than an aggregate dragged through the sort.
   *
   * Timestamps are `timestamp without time zone` holding UTC, so `now()` is converted to UTC first.
   * Usage counters are keyed by the UTC calendar month, which is what "this month" means here.
   */
  async fetchAll(query: ITenantsFetchQuery, options: IPaginationOptions = {}): Promise<PaginatedResponse<ITenantListItem>> {
    const sort = (options.sortBy && options.sortBy in ORDER_BY ? options.sortBy : "active") as TenantSort;
    const order = ORDER_BY[sort];
    const direction = Prisma.raw((options.sortOrder ?? order.defaultDir) === "asc" ? "ASC" : "DESC");

    const byPlan = query.planKey ? Prisma.sql`AND p.key = ${query.planKey}` : Prisma.empty;
    const like = query.keyword ? `%${escapeLike(query.keyword)}%` : null;
    const bySearch = like
      ? Prisma.sql`AND (r.name ILIKE ${like} OR r.slug ILIKE ${like} OR own.name ILIKE ${like} OR own.email ILIKE ${like})`
      : Prisma.empty;

    const offset = options.offset ?? 0;
    // `returnData: false` is a count-only request.
    const limit = options.returnData === false ? 0 : options.limit;
    const page = limit !== undefined ? Prisma.sql`LIMIT ${limit} OFFSET ${offset}` : Prisma.empty;

    // Shared by the page and the fallback count below.
    const listed = Prisma.sql`
      listed AS (
        SELECT
          r.id,
          r.name,
          r.slug,
          r.currency,
          r.is_active,
          r.created_at,
          s.status,
          s.interval,
          s.trial_ends_at,
          s.current_period_end,
          s.past_due_since,
          s.extra_branches,
          s.extra_seats,
          p.key  AS plan_key,
          p.name AS plan_name,
          p.limits,
          own.name  AS owner_name,
          own.email AS owner_email,
          act.last_active_at,
          CASE WHEN ${BILLING} THEN (
            CASE WHEN s.interval = 'ANNUAL' THEN ROUND(p.annual_price / 12.0) ELSE p.monthly_price END
            + s.extra_branches * COALESCE(p.extra_branch_price, 0)
            + s.extra_seats * COALESCE(p.extra_seat_price, 0)
          )::int ELSE 0 END AS mrr
        FROM subscriptions s
        JOIN restaurants r ON r.id = s.restaurant_id
        JOIN plans p ON p.id = s.plan_id
        LEFT JOIN LATERAL (
          SELECT u.name, u.email
          FROM restaurant_members m
          JOIN users u ON u.id = m.user_id
          WHERE m.restaurant_id = r.id AND m.role = 'OWNER'
          ORDER BY m.created_at
          LIMIT 1
        ) own ON TRUE
        LEFT JOIN LATERAL (
          SELECT o.created_at AS last_active_at
          FROM orders o
          WHERE o.restaurant_id = r.id
          ORDER BY o.created_at DESC
          LIMIT 1
        ) act ON TRUE
        WHERE ${VIEW_PREDICATE[query.view]} ${byPlan} ${bySearch}
      )
    `;

    const rows = await this.prisma.$queryRaw<TenantRow[]>`
      WITH ${listed},
      paged AS (
        SELECT
          l.*,
          ROW_NUMBER() OVER (ORDER BY ${order.column} ${direction} NULLS LAST, l.id) AS ord,
          (COUNT(*) OVER ())::int AS total
        FROM listed l
        ORDER BY ord
        ${page}
      )
      SELECT
        pg.id,
        pg.name,
        pg.slug,
        pg.currency,
        pg.is_active           AS "isActive",
        pg.created_at          AS "createdAt",
        pg.last_active_at      AS "lastActiveAt",
        pg.owner_name          AS "ownerName",
        pg.owner_email         AS "ownerEmail",
        pg.plan_key            AS "planKey",
        pg.plan_name           AS "planName",
        pg.limits,
        pg.status,
        pg.interval,
        pg.trial_ends_at       AS "trialEndsAt",
        pg.current_period_end  AS "currentPeriodEnd",
        pg.past_due_since      AS "pastDueSince",
        pg.extra_branches      AS "extraBranches",
        pg.extra_seats         AS "extraSeats",
        pg.mrr,
        pg.total,
        (SELECT COUNT(*)::int FROM branches b WHERE b.restaurant_id = pg.id AND b.is_active)            AS branches,
        (SELECT COUNT(*)::int FROM restaurant_members m WHERE m.restaurant_id = pg.id AND m.is_active)  AS seats,
        (SELECT c.orders FROM usage_counters c
          WHERE c.restaurant_id = pg.id AND c.period_start = date_trunc('month', timezone('UTC', now())))  AS "ordersThisMonth",
        (SELECT c.orders FROM usage_counters c
          WHERE c.restaurant_id = pg.id AND c.period_start = date_trunc('month', timezone('UTC', now())) - interval '1 month') AS "ordersLastMonth"
      FROM paged pg
      ORDER BY pg.ord
    `;

    // The window count rides on the rows, so it's lost when there are none: a count-only request,
    // or an offset past the last page. Only then is the total worth a second query.
    let count = rows[0]?.total ?? 0;
    if (rows.length === 0 && (offset > 0 || options.returnData === false)) {
      const [counted] = await this.prisma.$queryRaw<{ count: number }[]>`
        WITH ${listed}
        SELECT COUNT(*)::int AS count FROM listed
      `;
      count = counted?.count ?? 0;
    }

    const weekly = await this.fetchWeekly(rows.map(row => row.id));

    return {
      rows: rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        currency: row.currency,
        isActive: row.isActive,
        createdAt: row.createdAt,
        lastActiveAt: row.lastActiveAt,
        owner: row.ownerEmail ? { name: row.ownerName ?? row.ownerEmail, email: row.ownerEmail } : null,
        plan: { key: row.planKey, name: row.planName },
        status: row.status,
        interval: row.interval,
        trialEndsAt: row.trialEndsAt,
        currentPeriodEnd: row.currentPeriodEnd,
        pastDueSince: row.pastDueSince,
        branches: row.branches,
        seats: row.seats,
        extraBranches: row.extraBranches,
        extraSeats: row.extraSeats,
        limits: planLimitsSchema.parse(row.limits),
        ordersThisMonth: row.ordersThisMonth ?? 0,
        ordersLastMonth: row.ordersLastMonth ?? 0,
        weekly: weekly.get(row.id) ?? new Array<number>(WEEKS).fill(0),
        mrr: row.mrr,
      })),
      count,
    };
  }

  /** One grouped read over just the page's restaurants, oldest week first. */
  private async fetchWeekly(restaurantIds: string[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (restaurantIds.length === 0) return result;

    const rows = await this.prisma.$queryRaw<{ restaurantId: string; weeksAgo: number; orders: number }[]>`
      SELECT
        o.restaurant_id AS "restaurantId",
        FLOOR(EXTRACT(EPOCH FROM timezone('UTC', now()) - o.created_at) / 604800)::int AS "weeksAgo",
        COUNT(*)::int AS orders
      FROM orders o
      WHERE o.restaurant_id = ANY(${restaurantIds}::uuid[])
        AND o.created_at >= timezone('UTC', now()) - make_interval(weeks => ${WEEKS}::int)
      GROUP BY 1, 2
    `;

    for (const row of rows) {
      const series = result.get(row.restaurantId) ?? new Array<number>(WEEKS).fill(0);
      // index 0 is the oldest week, `WEEKS - 1` this one
      const index = WEEKS - 1 - Math.max(row.weeksAgo, 0);
      if (index >= 0 && index < WEEKS) series[index] += row.orders;
      result.set(row.restaurantId, series);
    }
    return result;
  }

  async countByView(): Promise<ITenantViewCounts> {
    const [row] = await this.prisma.$queryRaw<ITenantViewCounts[]>`
      SELECT
        COUNT(*)::int AS "all",
        (COUNT(*) FILTER (WHERE ${VIEW_PREDICATE.active}))::int    AS "active",
        (COUNT(*) FILTER (WHERE ${VIEW_PREDICATE.trial}))::int     AS "trial",
        (COUNT(*) FILTER (WHERE ${VIEW_PREDICATE.attention}))::int AS "attention",
        (COUNT(*) FILTER (WHERE ${VIEW_PREDICATE.closed}))::int    AS "closed"
      FROM subscriptions s
    `;
    return row ?? { all: 0, active: 0, trial: 0, attention: 0, closed: 0 };
  }
}

export default TenantRepositoryImpl;
