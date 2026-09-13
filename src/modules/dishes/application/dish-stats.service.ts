import { Injectable } from "@nestjs/common";
import { PrismaTransaction } from "../../../common/prisma";
import { IDish } from "../domain/interfaces/dish.interface";
import { EMPTY_DISH_STATS } from "../domain/interfaces/dish-stats.interface";
import { IDishWithStats } from "../domain/interfaces/dish-with-stats.interface";
import { DishStatsRepository } from "../domain/repositories/dish-stats.repository";
import { dishBadges, rankScore } from "../domain/utils/dish-ranking.util";

/**
 * Turns plain dish rows into what a screen actually renders: the dish plus its
 * §12 metrics and the §49 badges those metrics earn. Shared by the menu, the
 * dish detail screen and the dashboard's menu board.
 */
@Injectable()
export class DishStatsService {
  constructor(private readonly dishStatsRepository: DishStatsRepository) {}

  async attach(dishes: IDish[], options?: { tx?: PrismaTransaction }): Promise<IDishWithStats[]> {
    if (dishes.length === 0) return [];

    const stats = await this.dishStatsRepository.fetchStatsFor(
      dishes.map(dish => dish.id),
      options
    );

    return dishes.map(dish => {
      const dishStats = stats.get(dish.id) ?? EMPTY_DISH_STATS;
      return { ...dish, stats: dishStats, badges: dishBadges(dish, dishStats) };
    });
  }

  async attachOne(dish: IDish, options?: { tx?: PrismaTransaction }): Promise<IDishWithStats> {
    const [withStats] = await this.attach([dish], options);
    return withStats;
  }

  /** §49 — highest-scoring first, with the popularity term scaled to this set. */
  rank(dishes: IDishWithStats[]): IDishWithStats[] {
    const maxOrders30d = Math.max(0, ...dishes.map(dish => dish.stats.orders30d));
    return [...dishes].sort((a, b) => rankScore(b.stats, maxOrders30d) - rankScore(a.stats, maxOrders30d));
  }
}
