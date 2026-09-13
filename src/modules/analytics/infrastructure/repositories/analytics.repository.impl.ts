import { Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import {
  IAnalyticsRange,
  IDishPerformance,
  IFeedbackSummary,
  IHourlyOrders,
  IOrderSummary,
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

  async fetchOrderSummary(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IOrderSummary> {
    const prisma = options?.tx ?? this.prisma;
    const where = this.ordersWhere(restaurantId, range);

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

  async fetchDishPerformance(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IDishPerformance[]> {
    const prisma = options?.tx ?? this.prisma;

    const items = await prisma.orderItem.findMany({
      where: { order: { ...this.ordersWhere(restaurantId, range), status: OrderStatus.COMPLETED } },
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
      where: { dishId: { in: ranked.map(row => row.dishId) }, isHidden: false },
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

  async fetchFeedbackSummary(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IFeedbackSummary> {
    const prisma = options?.tx ?? this.prisma;
    const where: Prisma.DishReviewWhereInput = {
      restaurantId,
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

  async fetchBusiestHours(restaurantId: string, range: IAnalyticsRange, options?: AnalyticsFetchOptions): Promise<IHourlyOrders[]> {
    const prisma = options?.tx ?? this.prisma;

    const orders = await prisma.order.findMany({
      where: { ...this.ordersWhere(restaurantId, range), status: { not: OrderStatus.CANCELLED } },
      select: { createdAt: true },
    });

    const hours = new Array<number>(24).fill(0);
    for (const order of orders) {
      hours[order.createdAt.getUTCHours()] += 1;
    }

    return hours.map((count, hour) => ({ hour, orders: count }));
  }

  private ordersWhere(restaurantId: string, range: IAnalyticsRange): Prisma.OrderWhereInput {
    return { restaurantId, createdAt: { gte: range.from, lte: range.to } };
  }
}

export default AnalyticsRepositoryImpl;
