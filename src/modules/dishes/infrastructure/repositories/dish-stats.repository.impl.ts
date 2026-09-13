import { Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import { TOP_TAGS_LIMIT } from "../../domain/constants/merchandising";
import { EMPTY_DISH_STATS, IDishStats } from "../../domain/interfaces/dish-stats.interface";
import { DishStatsFetchOptions, DishStatsRepository } from "../../domain/repositories/dish-stats.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

/**
 * §12 — every number on a dish card in one pass over the review and order-item
 * tables, for every dish asked about at once. Fanning out per dish would turn a
 * menu screen into a hundred round trips.
 */
@Injectable()
class DishStatsRepositoryImpl implements DishStatsRepository {
  constructor(private prisma: PrismaService) {}

  async fetchStatsFor(dishIds: string[], options?: DishStatsFetchOptions): Promise<Map<string, IDishStats>> {
    const stats = new Map<string, IDishStats>();
    if (dishIds.length === 0) return stats;

    const prisma = options?.tx ?? this.prisma;
    const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
    const now = Date.now();
    const windowStart = new Date(now - windowDays * DAY_MS);
    const previousWindowStart = new Date(now - 2 * windowDays * DAY_MS);

    const visibleReviews = { dishId: { in: dishIds }, isHidden: false };
    const soldItems = (from: Date, to?: Date) => ({
      dishId: { in: dishIds },
      order: {
        status: { not: OrderStatus.CANCELLED },
        createdAt: to ? { gte: from, lt: to } : { gte: from },
      },
    });

    const [ratings, distribution, recommends, currentOrders, previousOrders, tagRows] = await Promise.all([
      prisma.dishReview.groupBy({
        by: ["dishId"],
        where: visibleReviews,
        _count: { _all: true },
        _avg: { overall: true, taste: true, portion: true, value: true },
      }),
      prisma.dishReview.groupBy({ by: ["dishId", "overall"], where: visibleReviews, _count: { _all: true } }),
      prisma.dishReview.groupBy({
        by: ["dishId"],
        where: { ...visibleReviews, wouldOrderAgain: true },
        _count: { _all: true },
      }),
      prisma.orderItem.groupBy({ by: ["dishId"], where: soldItems(windowStart), _sum: { quantity: true } }),
      prisma.orderItem.groupBy({
        by: ["dishId"],
        where: soldItems(previousWindowStart, windowStart),
        _sum: { quantity: true },
      }),
      prisma.dishReviewTag.findMany({
        where: { review: visibleReviews },
        select: { review: { select: { dishId: true } }, tag: { select: { label: true } } },
      }),
    ]);

    const topTags = this.countTags(tagRows);

    for (const dishId of dishIds) {
      const rating = ratings.find(row => row.dishId === dishId);
      const ratingCount = rating?._count._all ?? 0;
      const recommendCount = recommends.find(row => row.dishId === dishId)?._count._all ?? 0;

      stats.set(dishId, {
        ...EMPTY_DISH_STATS,
        ratingCount,
        avgRating: round(rating?._avg.overall),
        taste: round(rating?._avg.taste),
        portion: round(rating?._avg.portion),
        value: round(rating?._avg.value),
        recommendRate: ratingCount > 0 ? recommendCount / ratingCount : null,
        distribution: this.buildDistribution(dishId, distribution),
        orders30d: currentOrders.find(row => row.dishId === dishId)?._sum.quantity ?? 0,
        ordersPrev30d: previousOrders.find(row => row.dishId === dishId)?._sum.quantity ?? 0,
        topTags: topTags.get(dishId) ?? [],
      });
    }

    return stats;
  }

  private buildDistribution(
    dishId: string,
    rows: { dishId: string; overall: number; _count: { _all: number } }[]
  ): IDishStats["distribution"] {
    const distribution: IDishStats["distribution"] = [0, 0, 0, 0, 0];

    for (const row of rows) {
      if (row.dishId !== dishId) continue;
      const bucket = Math.min(4, Math.max(0, Math.round(row.overall) - 1));
      distribution[bucket] += row._count._all;
    }

    return distribution;
  }

  private countTags(rows: { review: { dishId: string }; tag: { label: string } }[]): Map<string, IDishStats["topTags"]> {
    const counts = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const perDish = counts.get(row.review.dishId) ?? new Map<string, number>();
      perDish.set(row.tag.label, (perDish.get(row.tag.label) ?? 0) + 1);
      counts.set(row.review.dishId, perDish);
    }

    const topTags = new Map<string, IDishStats["topTags"]>();
    for (const [dishId, perDish] of counts) {
      topTags.set(
        dishId,
        [...perDish.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
          .slice(0, TOP_TAGS_LIMIT)
      );
    }

    return topTags;
  }
}

function round(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value.toFixed(2));
}

export default DishStatsRepositoryImpl;
