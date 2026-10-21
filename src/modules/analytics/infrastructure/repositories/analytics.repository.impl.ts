import { Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import {
  IAnalyticsRange,
  IAnalyticsScope,
  IBranchPerformance,
  IDishPerformance,
  IFeedbackSummary,
  IHourlyOrders,
  IOrderComparisonTotals,
  IOrderSummary,
  IProfitLossFigures,
  IRevenueBucket,
  IRevenueTotals,
  RevenueTrendGranularity,
  ITopSellingDish,
} from "../../domain/interfaces/analytics.interface";
import { AnalyticsFetchOptions, AnalyticsRepository } from "../../domain/repositories/analytics.repository";

const DEFAULT_DISH_LIMIT = 20;
const TOP_TAGS_LIMIT = 6;

/**
 * §31. Line-level revenue is summed in memory because the sum of
 * `unit_price * quantity` is not something Prisma's aggregate API can express;
 * swap these two reads for a SQL rollup (or a nightly materialised table) once a
 * restaurant's month no longer fits comfortably in one query.
 */
@Injectable()
class AnalyticsRepositoryImpl implements AnalyticsRepository {
  constructor(private prisma: PrismaService) {}

  async fetchOrderSummary(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IOrderSummary> {
    const prisma = options?.tx ?? this.prisma;
    const where = this.ordersWhere(scope, range);

    const [counts, revenue] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.order.aggregate({
        where: { ...where, status: OrderStatus.COMPLETED },
        _sum: { total: true, subtotal: true, serviceCharge: true, tax: true, discount: true },
        _count: { _all: true },
      }),
    ]);

    const total = counts.reduce((sum, row) => sum + row._count._all, 0);
    const completed = revenue._count._all;
    const cancelled = counts.find(row => row.status === OrderStatus.CANCELLED)?._count._all ?? 0;
    const grossRevenue = revenue._sum.total ?? 0;

    return {
      total,
      completed,
      cancelled,
      grossRevenue,
      netRevenue: revenue._sum.subtotal ?? 0,
      serviceCharge: revenue._sum.serviceCharge ?? 0,
      tax: revenue._sum.tax ?? 0,
      discount: revenue._sum.discount ?? 0,
      averageOrderValue: completed > 0 ? Math.round(grossRevenue / completed) : 0,
    };
  }

  async fetchDishPerformance(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IDishPerformance[]> {
    const prisma = options?.tx ?? this.prisma;

    const items = await prisma.orderItem.findMany({
      where: { order: { ...this.ordersWhere(scope, range), status: OrderStatus.COMPLETED } },
      select: { dishId: true, dishNameSnapshot: true, unitPrice: true, quantity: true },
    });

    const performance = new Map<string, IDishPerformance>();
    for (const item of items) {
      const row = performance.get(item.dishId) ?? {
        dishId: item.dishId,
        name: item.dishNameSnapshot,
        quantity: 0,
        revenue: 0,
        avgRating: null,
        ratingCount: 0,
      };
      row.quantity += item.quantity;
      row.revenue += item.unitPrice * item.quantity;
      performance.set(item.dishId, row);
    }

    const ranked = [...performance.values()].sort((a, b) => b.revenue - a.revenue).slice(0, options?.dishLimit ?? DEFAULT_DISH_LIMIT);

    const ratings = await prisma.dishReview.groupBy({
      by: ["dishId"],
      where: { ...this.reviewsWhere(scope), dishId: { in: ranked.map(row => row.dishId) }, isHidden: false },
      _avg: { overall: true },
      _count: { _all: true },
    });

    return ranked.map(row => {
      const rating = ratings.find(candidate => candidate.dishId === row.dishId);
      return {
        ...row,
        avgRating: rating?._avg.overall === null || rating === undefined ? null : Number(rating._avg.overall.toFixed(2)),
        ratingCount: rating?._count._all ?? 0,
      };
    });
  }

  async fetchFeedbackSummary(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IFeedbackSummary> {
    const prisma = options?.tx ?? this.prisma;
    const where: Prisma.DishReviewWhereInput = {
      ...this.reviewsWhere(scope),
      isHidden: false,
      createdAt: { gte: range.from, lte: range.to },
    };

    const [aggregate, distribution, recommends, tagRows] = await Promise.all([
      prisma.dishReview.aggregate({ where, _avg: { overall: true }, _count: { _all: true } }),
      prisma.dishReview.groupBy({ by: ["overall"], where, _count: { _all: true } }),
      prisma.dishReview.count({ where: { ...where, wouldOrderAgain: true } }),
      prisma.dishReviewTag.findMany({ where: { review: where }, select: { tag: { select: { label: true } } } }),
    ]);

    const ratingCount = aggregate._count._all;
    const buckets: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const row of distribution) {
      buckets[Math.min(4, Math.max(0, Math.round(row.overall) - 1))] += row._count._all;
    }

    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      tagCounts.set(row.tag.label, (tagCounts.get(row.tag.label) ?? 0) + 1);
    }

    return {
      ratingCount,
      avgRating: aggregate._avg.overall === null ? null : Number(aggregate._avg.overall.toFixed(2)),
      recommendRate: ratingCount > 0 ? recommends / ratingCount : null,
      distribution: buckets,
      topTags: [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
        .slice(0, TOP_TAGS_LIMIT),
    };
  }

  async fetchBusiestHours(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IHourlyOrders[]> {
    const prisma = options?.tx ?? this.prisma;

    const orders = await prisma.order.findMany({
      where: { ...this.ordersWhere(scope, range), status: { not: OrderStatus.CANCELLED } },
      select: { createdAt: true },
    });

    const hours = new Array<number>(24).fill(0);
    for (const order of orders) {
      hours[order.createdAt.getUTCHours()] += 1;
    }

    return hours.map((count, hour) => ({ hour, orders: count }));
  }

  async fetchRevenueComparison(
    scope: IAnalyticsScope,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IRevenueTotals> {
    const prisma = options?.tx ?? this.prisma;

    const [row] = await prisma.$queryRaw<{ current: bigint; previous: bigint }[]>`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE created_at >= ${currentRange.from} AND created_at < ${currentRange.to}), 0)::bigint AS current,
        COALESCE(SUM(total) FILTER (WHERE created_at >= ${previousRange.from} AND created_at < ${previousRange.to}), 0)::bigint AS previous
      FROM payments
      WHERE restaurant_id = ${scope.restaurantId}::uuid
        AND (${scope.branchIds ?? null}::uuid[] IS NULL OR branch_id = ANY(${scope.branchIds ?? null}::uuid[]))
        AND created_at >= ${previousRange.from}
        AND created_at < ${currentRange.to}
    `;

    return { current: Number(row?.current ?? 0n), previous: Number(row?.previous ?? 0n) };
  }

  /**
   * One index range scan over `payments(restaurant_id, created_at)`, grouped in the database so only
   * the non-empty buckets come back. `created_at` is a UTC `timestamp`, so it is read as UTC and then
   * moved to the restaurant's wall clock before truncating — the range filter itself stays on the raw
   * column so the index is still used. `unit` and `format` are picked from fixed literals, never from input.
   */
  async fetchRevenueByBucket(
    scope: IAnalyticsScope,
    range: IAnalyticsRange,
    granularity: RevenueTrendGranularity,
    timeZone: string,
    options?: AnalyticsFetchOptions
  ): Promise<IRevenueBucket[]> {
    const prisma = options?.tx ?? this.prisma;
    const unit = Prisma.raw(granularity === "day" ? "'day'" : "'month'");
    const format = Prisma.raw(granularity === "day" ? "'YYYY-MM-DD'" : "'YYYY-MM'");

    const rows = await prisma.$queryRaw<{ key: string; revenue: bigint }[]>`
      SELECT
        to_char(date_trunc(${unit}, created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timeZone}::text), ${format}) AS key,
        SUM(total)::bigint AS revenue
      FROM payments
      WHERE restaurant_id = ${scope.restaurantId}::uuid
        AND (${scope.branchIds ?? null}::uuid[] IS NULL OR branch_id = ANY(${scope.branchIds ?? null}::uuid[]))
        AND created_at >= ${range.from}
        AND created_at < ${range.to}
      GROUP BY 1
    `;

    return rows.map(row => ({ key: row.key, revenue: Number(row.revenue) }));
  }

  /**
   * §31 — same single-scan shape as `fetchRevenueComparison`. Unlike
   * `payments`, `orders` has no `(restaurant_id, created_at)` index yet
   * (only `(restaurant_id, status)`), so this still walks every one of the
   * restaurant's orders in the combined window rather than a tight range
   * scan; add that index if this ever shows up as slow.
   */
  async fetchOrderComparison(
    scope: IAnalyticsScope,
    currentRange: IAnalyticsRange,
    previousRange: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IOrderComparisonTotals> {
    const prisma = options?.tx ?? this.prisma;

    const [row] = await prisma.$queryRaw<{ current: bigint; previous: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= ${currentRange.from} AND created_at < ${currentRange.to})::bigint AS current,
        COUNT(*) FILTER (WHERE created_at >= ${previousRange.from} AND created_at < ${previousRange.to})::bigint AS previous
      FROM orders
      WHERE restaurant_id = ${scope.restaurantId}::uuid
        AND (${scope.branchIds ?? null}::uuid[] IS NULL OR branch_id = ANY(${scope.branchIds ?? null}::uuid[]))
        AND status <> ${OrderStatus.CANCELLED}::"OrderStatus"
        AND created_at >= ${previousRange.from}
        AND created_at < ${currentRange.to}
    `;

    return { current: Number(row?.current ?? 0n), previous: Number(row?.previous ?? 0n) };
  }

  /**
   * §31 — sourced from `payment_items`, not `order_items`: an order only
   * counts as "sold" once it's actually been paid for, the same reasoning
   * `fetchRevenueComparison` already applies to the `payments` table. Revenue
   * is summed in memory for the same reason as `fetchDishPerformance` above.
   */
  async fetchTopSellingDishes(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<ITopSellingDish[]> {
    const prisma = options?.tx ?? this.prisma;

    const items = await prisma.paymentItem.findMany({
      where: { payment: { ...this.scopeWhere(scope), createdAt: { gte: range.from, lt: range.to } } },
      select: { dishId: true, dishNameSnapshot: true, unitPrice: true, quantity: true },
    });

    const dishes = new Map<string, ITopSellingDish>();
    for (const item of items) {
      const row = dishes.get(item.dishId) ?? { dishId: item.dishId, dishName: item.dishNameSnapshot, orderCount: 0, totalAmount: 0 };
      row.orderCount += item.quantity;
      row.totalAmount += item.unitPrice * item.quantity;
      dishes.set(item.dishId, row);
    }

    return [...dishes.values()].sort((a, b) => b.orderCount - a.orderCount);
  }

  async fetchBranchPerformance(
    scope: IAnalyticsScope,
    range: IAnalyticsRange,
    options?: AnalyticsFetchOptions
  ): Promise<IBranchPerformance[]> {
    const prisma = options?.tx ?? this.prisma;
    const where = this.ordersWhere(scope, range);

    const [branches, counts, revenue] = await Promise.all([
      prisma.branch.findMany({
        where: { restaurantId: scope.restaurantId, ...(scope.branchIds && { id: { in: scope.branchIds } }) },
        select: { id: true, name: true },
      }),
      prisma.order.groupBy({ by: ["branchId", "status"], where, _count: { _all: true } }),
      prisma.order.groupBy({ by: ["branchId"], where: { ...where, status: OrderStatus.COMPLETED }, _sum: { total: true } }),
    ]);

    return branches
      .map(branch => {
        const own = counts.filter(row => row.branchId === branch.id);
        const completed = own.find(row => row.status === OrderStatus.COMPLETED)?._count._all ?? 0;
        const cancelled = own.find(row => row.status === OrderStatus.CANCELLED)?._count._all ?? 0;
        const grossRevenue = revenue.find(row => row.branchId === branch.id)?._sum.total ?? 0;
        return {
          branchId: branch.id,
          branchName: branch.name,
          orders: own.reduce((sum, row) => sum + row._count._all, 0),
          completed,
          cancelled,
          grossRevenue,
          averageOrderValue: completed > 0 ? Math.round(grossRevenue / completed) : 0,
        };
      })
      .sort((a, b) => b.grossRevenue - a.grossRevenue || a.branchName.localeCompare(b.branchName));
  }

  /** `orders`/`payments` both carry `restaurantId` and `branchId` directly. */
  private scopeWhere(scope: IAnalyticsScope): { restaurantId: string; branchId?: { in: string[] } } {
    return { restaurantId: scope.restaurantId, ...(scope.branchIds && { branchId: { in: scope.branchIds } }) };
  }

  private ordersWhere(scope: IAnalyticsScope, range: IAnalyticsRange): Prisma.OrderWhereInput {
    return { ...this.scopeWhere(scope), createdAt: { gte: range.from, lte: range.to } };
  }

  /** A review has no branch of its own — it belongs to the branch of the order it rates. */
  private reviewsWhere(scope: IAnalyticsScope): Prisma.DishReviewWhereInput {
    return {
      restaurantId: scope.restaurantId,
      ...(scope.branchIds && { order: { branchId: { in: scope.branchIds } } }),
    };
  }

  /**
   * Expense rows named "stock" are purchases (cost reaches the statement through consumption instead) and
   * "refund" is already taken off revenue, so neither is spend. Matching is on the literal category the
   * postings write, case-insensitive; a hand-typed variant like "stocks" would count as spend.
   * ponytail: a marker column on Expense would replace the string match.
   */
  async fetchProfitLossFigures(scope: IAnalyticsScope, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IProfitLossFigures> {
    const prisma = options?.tx ?? this.prisma;
    const branchIds = scope.branchIds ?? null;

    const [sales, refunds, stock, waste, expenses] = await Promise.all([
      prisma.$queryRaw<{ sales: bigint; tax: bigint }[]>`
        SELECT COALESCE(SUM(total - tax), 0)::bigint AS sales, COALESCE(SUM(tax), 0)::bigint AS tax
        FROM payments
        WHERE restaurant_id = ${scope.restaurantId}::uuid
          AND (${branchIds}::uuid[] IS NULL OR branch_id = ANY(${branchIds}::uuid[]))
          AND created_at >= ${range.from} AND created_at < ${range.to}`,
      // A refund's amount includes the bill's tax, so scale it to the same net-of-tax basis as `sales`.
      prisma.$queryRaw<{ refunds: bigint }[]>`
        SELECT COALESCE(ROUND(SUM(r.amount::float8 * (p.total - p.tax) / NULLIF(p.total, 0))), 0)::bigint AS refunds
        FROM payment_refunds r
        JOIN payments p ON p.id = r.payment_id
        WHERE r.restaurant_id = ${scope.restaurantId}::uuid
          AND (${branchIds}::uuid[] IS NULL OR r.branch_id = ANY(${branchIds}::uuid[]))
          AND r.created_at >= ${range.from} AND r.created_at < ${range.to}`,
      // Stock at a past moment = quantity now − every movement since, valued at the average price paid for the
      // lots received by then. ponytail: average-cost, so price swings between the two ends show up as cost.
      prisma.$queryRaw<{ opening: number; closing: number; purchases: number; stock_out: number; unpriced: bigint }[]>`
        WITH ing AS (
          SELECT id, quantity FROM ingredients
          WHERE restaurant_id = ${scope.restaurantId}::uuid
            AND (${branchIds}::uuid[] IS NULL OR branch_id = ANY(${branchIds}::uuid[]))
        ),
        held AS (
          SELECT ing.id,
                 GREATEST(ing.quantity - COALESCE(SUM(m.delta), 0), 0) AS open_qty,
                 GREATEST(ing.quantity - COALESCE(SUM(m.delta) FILTER (WHERE m.created_at >= ${range.to}), 0), 0) AS close_qty
          FROM ing
          LEFT JOIN stock_movements m ON m.ingredient_id = ing.id AND m.created_at >= ${range.from}
          GROUP BY ing.id, ing.quantity
        ),
        price AS (
          SELECT ing.id,
                 (SUM(l.cost) FILTER (WHERE l.received_at < ${range.from} AND l.cost IS NOT NULL AND l.quantity > 0))::float8
                   / NULLIF(SUM(l.quantity) FILTER (WHERE l.received_at < ${range.from} AND l.cost IS NOT NULL AND l.quantity > 0), 0) AS open_unit,
                 (SUM(l.cost) FILTER (WHERE l.received_at < ${range.to} AND l.cost IS NOT NULL AND l.quantity > 0))::float8
                   / NULLIF(SUM(l.quantity) FILTER (WHERE l.received_at < ${range.to} AND l.cost IS NOT NULL AND l.quantity > 0), 0) AS close_unit,
                 COALESCE(SUM(l.cost) FILTER (WHERE NOT l.from_transfer AND l.received_at >= ${range.from} AND l.received_at < ${range.to}), 0) AS bought,
                 BOOL_OR(l.cost IS NULL AND NOT l.from_transfer AND l.received_at >= ${range.from} AND l.received_at < ${range.to}) AS bought_unpriced
          FROM ing LEFT JOIN stock_lots l ON l.ingredient_id = ing.id
          GROUP BY ing.id
        ),
        moved AS (
          SELECT m.ingredient_id AS id,
                 COALESCE(SUM(m.delta) FILTER (WHERE m.reason = 'TRANSFER_IN'), 0) AS qty_in,
                 COALESCE(SUM(-m.delta) FILTER (WHERE m.reason = 'TRANSFER_OUT'), 0) AS qty_out,
                 -- A supplier return takes the stock off at once and credits only what the supplier gave back.
                 COALESCE(SUM(m.cost) FILTER (WHERE m.reason = 'RETURN'), 0) AS refunded
          FROM stock_movements m JOIN ing ON ing.id = m.ingredient_id
          WHERE m.reason IN ('TRANSFER_IN', 'TRANSFER_OUT', 'RETURN') AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
          GROUP BY m.ingredient_id
        )
        SELECT COALESCE(SUM(h.open_qty * COALESCE(p.open_unit, 0)), 0)::float8 AS opening,
               COALESCE(SUM(h.close_qty * COALESCE(p.close_unit, 0)), 0)::float8 AS closing,
               COALESCE(SUM(p.bought + COALESCE(g.qty_in, 0) * COALESCE(p.close_unit, 0)), 0)::float8 AS purchases,
               COALESCE(SUM(COALESCE(g.qty_out, 0) * COALESCE(p.close_unit, 0) + COALESCE(g.refunded, 0)), 0)::float8 AS stock_out,
               (COUNT(*) FILTER (WHERE (h.open_qty > 0 AND p.open_unit IS NULL) OR (h.close_qty > 0 AND p.close_unit IS NULL) OR p.bought_unpriced))::bigint AS unpriced
        FROM held h
        JOIN price p ON p.id = h.id
        LEFT JOIN moved g ON g.id = h.id`,
      prisma.$queryRaw<{ cost: bigint; unpriced: bigint }[]>`
        SELECT COALESCE(SUM(sm.waste_cost), 0)::bigint AS cost, (COUNT(*) FILTER (WHERE sm.waste_cost IS NULL))::bigint AS unpriced
        FROM stock_movements sm
        JOIN ingredients i ON i.id = sm.ingredient_id
        WHERE sm.reason = 'WASTE'
          AND i.restaurant_id = ${scope.restaurantId}::uuid
          AND (${branchIds}::uuid[] IS NULL OR i.branch_id = ANY(${branchIds}::uuid[]))
          AND sm.created_at >= ${range.from} AND sm.created_at < ${range.to}`,
      prisma.$queryRaw<{ category: string; amount: bigint }[]>`
        SELECT MIN(category) AS category, SUM(amount)::bigint AS amount
        FROM expenses
        WHERE restaurant_id = ${scope.restaurantId}::uuid
          AND (${branchIds}::uuid[] IS NULL OR branch_id = ANY(${branchIds}::uuid[]))
          AND kind = 'EXPENSE'
          AND lower(trim(category)) NOT IN ('stock', 'refund')
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY lower(trim(category))
        ORDER BY SUM(amount) DESC`,
    ]);

    return {
      sales: Number(sales[0].sales),
      tax: Number(sales[0].tax),
      refunds: Number(refunds[0].refunds),
      stockOpening: Math.round(stock[0].opening),
      stockClosing: Math.round(stock[0].closing),
      stockPurchases: Math.round(stock[0].purchases),
      stockOut: Math.round(stock[0].stock_out),
      unpricedItems: Number(stock[0].unpriced),
      waste: Number(waste[0].cost),
      wasteUnpricedCount: Number(waste[0].unpriced),
      expenses: expenses.map(e => ({ category: e.category, amount: Number(e.amount) })),
    };
  }
}

export default AnalyticsRepositoryImpl;
