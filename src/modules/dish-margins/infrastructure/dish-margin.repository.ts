import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/prisma";
import { MarginSort } from "../dish-margins.interface";
import { MarginRow } from "../margin.util";

const ORDER: Record<MarginSort, Prisma.Sql> = {
  marginPct: Prisma.sql`margin_pct DESC NULLS LAST, units DESC`,
  margin: Prisma.sql`margin DESC NULLS LAST, units DESC`,
  units: Prisma.sql`units DESC`,
  name: Prisma.sql`lower(name) ASC`,
};

@Injectable()
export class DishMarginRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Realised food cost, straight from what orders consumed: an order line's cost is the sum of each lot it drew
   * from, at that lot's price per unit. A line counts as costed only if it consumed stock and every lot it
   * touched has a price — no recipe, no stock tracking, or an unpriced lot all leave it uncosted, never free.
   * Recipe cost is the base recipe at each ingredient's latest priced lot. Timestamps hold UTC.
   *
   * Ratings are all-time visible reviews, not limited to the date range: reviews are too sparse to judge a dish on a month.
   *
   * ponytail: capped at 500 dishes; a menu that outgrows that needs paging.
   */
  async fetch(q: { restaurantId: string; branchId: string; from: Date; to: Date; sortBy: MarginSort }): Promise<MarginRow[]> {
    return this.prisma.$queryRaw<MarginRow[]>`
      WITH item_cost AS (
        SELECT lc.order_item_id,
               SUM(lc.quantity::float8 * l.cost / NULLIF(l.quantity, 0)) AS cost,
               BOOL_AND(l.cost IS NOT NULL AND l.quantity > 0)          AS known
        FROM lot_consumptions lc
        JOIN stock_lots l ON l.id = lc.lot_id
        GROUP BY lc.order_item_id
      ),
      sold AS (
        SELECT oi.dish_id,
               SUM(oi.quantity)::int                                                  AS units,
               SUM(oi.unit_price * oi.quantity)::float8                               AS revenue,
               COALESCE(SUM(oi.quantity) FILTER (WHERE ic.known), 0)::int             AS costed_units,
               COALESCE(SUM(oi.unit_price * oi.quantity) FILTER (WHERE ic.known), 0)::float8 AS costed_revenue,
               SUM(ic.cost) FILTER (WHERE ic.known)                                   AS cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN item_cost ic ON ic.order_item_id = oi.id
        WHERE o.restaurant_id = ${q.restaurantId}::uuid
          AND o.branch_id = ${q.branchId}::uuid
          AND o.created_at >= ${q.from} AND o.created_at < ${q.to}
          AND o.status <> 'CANCELLED' AND oi.status <> 'CANCELLED'
        GROUP BY oi.dish_id
      ),
      unit_cost AS (
        SELECT DISTINCT ON (ingredient_id) ingredient_id, cost::float8 / quantity AS per_unit
        FROM stock_lots
        WHERE cost IS NOT NULL AND quantity > 0
        ORDER BY ingredient_id, received_at DESC
      ),
      recipe AS (
        SELECT rl.dish_id,
               CASE WHEN BOOL_AND(uc.per_unit IS NOT NULL) THEN SUM(rl.quantity * uc.per_unit) END AS recipe_cost
        FROM recipe_lines rl
        LEFT JOIN unit_cost uc ON uc.ingredient_id = rl.ingredient_id
        WHERE rl.variant_id IS NULL AND rl.add_on_id IS NULL
        GROUP BY rl.dish_id
      ),
      rated AS (
        SELECT dish_id, COUNT(*)::int AS rating_count, AVG(overall)::float8 AS avg_rating,
               COUNT(*) FILTER (WHERE would_order_again)::int AS again_count
        FROM dish_reviews
        WHERE restaurant_id = ${q.restaurantId}::uuid AND NOT is_hidden
        GROUP BY dish_id
      ),
      shaped AS (
        SELECT d.id AS dish_id, d.name, d.price,
               COALESCE(rt.rating_count, 0) AS rating_count, rt.avg_rating, rt.again_count,
               COALESCE(s.units, 0) AS units, COALESCE(s.revenue, 0) AS revenue,
               COALESCE(s.costed_units, 0) AS costed_units, COALESCE(s.costed_revenue, 0) AS costed_revenue,
               s.cost, r.recipe_cost,
               s.costed_revenue - s.cost AS margin,
               CASE WHEN s.costed_revenue > 0 THEN (s.costed_revenue - s.cost) / s.costed_revenue END AS margin_pct
        FROM dishes d
        LEFT JOIN sold s ON s.dish_id = d.id
        LEFT JOIN recipe r ON r.dish_id = d.id
        LEFT JOIN rated rt ON rt.dish_id = d.id
        WHERE d.restaurant_id = ${q.restaurantId}::uuid AND d.branch_id = ${q.branchId}::uuid
          AND (NOT d.is_archived OR s.units > 0)
      )
      SELECT dish_id AS "dishId", name, price, units, revenue, costed_units AS "costedUnits",
             costed_revenue AS "costedRevenue", cost, recipe_cost AS "recipeCost",
             rating_count AS "ratingCount", avg_rating AS "avgRating", again_count AS "againCount"
      FROM shaped
      ORDER BY ${ORDER[q.sortBy]}, dish_id
      LIMIT 500`;
  }
}
