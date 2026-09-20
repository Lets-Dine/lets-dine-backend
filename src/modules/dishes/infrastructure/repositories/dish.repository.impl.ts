import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { TOP_TAGS_LIMIT } from "../../domain/constants/merchandising";
import { IDish } from "../../domain/interfaces/dish.interface";
import { IDishStats } from "../../domain/interfaces/dish-stats.interface";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";
import {
  DishFetchOptions,
  DishRepository,
  IDishCreate,
  IDishesFetchOptions,
  IDishesFetchQuery,
  IDishesWithStatsOptions,
  IDishUpdate,
} from "../../domain/repositories/dish.repository";
import { dishBadges } from "../../domain/utils/dish-ranking.util";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

type DishWithStatsRow = IDish & { stats: IDishStats };

@Injectable()
class DishRepositoryImpl implements DishRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: DishFetchOptions): Promise<IDish | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findUnique({ where: { id } });
  }

  async findBySlug(restaurantId: string, slug: string, options?: DishFetchOptions): Promise<IDish | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } });
  }

  async findManyByIds(ids: string[], options?: DishFetchOptions): Promise<IDish[]> {
    if (ids.length === 0) return [];
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.findMany({ where: { id: { in: ids } } });
  }

  async create(data: IDishCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.create({ data: { ...data, createdBy: options?.actorId, updatedBy: options?.actorId } });
  }

  async update(id: string, data: IDishUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.dish.update({ where: { id }, data: { ...data, updatedBy: options?.actorId } });
  }

  async fetchAll(query: IDishesFetchQuery, options?: IDishesFetchOptions): Promise<PaginatedResponse<IDish>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"name" | "price" | "sortOrder" | "createdAt">(options ?? {});

    const where: Prisma.DishWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.ids && { id: { in: query.ids } }),
      ...(query.isAvailable !== undefined && { isAvailable: query.isAvailable }),
      ...(query.isArchived !== undefined && { isArchived: query.isArchived }),
      ...(query.isFeatured !== undefined && { isFeatured: query.isFeatured }),
      ...(query.keyword && {
        OR: [
          { name: { contains: query.keyword, mode: "insensitive" as const } },
          { description: { contains: query.keyword, mode: "insensitive" as const } },
        ],
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.dish.findMany({
            where,
            ...paginationQuery,
            orderBy: orderBy ?? [{ sortOrder: "asc" }, { name: "asc" }],
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.dish.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }

  /**
   * The ORM path (`fetchAll` + `DishStatsService.attach`) is a dish query
   * followed by six review/order aggregate queries fanned out across every
   * dish on the menu. This is the diner-facing menu's hottest read, so it
   * goes straight to SQL instead: one query per restaurant, with each dish's
   * review stats, order velocity and top tags folded in via lateral joins
   * rather than fetched separately and stitched together in JS.
   */
  async findAllWithStats(query: IDishesFetchQuery, options?: IDishesWithStatsOptions): Promise<IDishWithStats[]> {
    const prisma = options?.tx ?? this.prisma;
    const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
    const previousWindowStart = new Date(now.getTime() - 2 * windowDays * DAY_MS);

    const conditions = [Prisma.sql`1 = 1`];
    if (query.restaurantId) conditions.push(Prisma.sql`d.restaurant_id = ${query.restaurantId}::uuid`);
    if (query.categoryId) conditions.push(Prisma.sql`d.category_id = ${query.categoryId}::uuid`);
    if (query.ids?.length) conditions.push(Prisma.sql`d.id IN (${Prisma.join(query.ids.map(id => Prisma.sql`${id}::uuid`))})`);
    if (query.isAvailable !== undefined) conditions.push(Prisma.sql`d.is_available = ${query.isAvailable}`);
    if (query.isArchived !== undefined) conditions.push(Prisma.sql`d.is_archived = ${query.isArchived}`);
    if (query.isFeatured !== undefined) conditions.push(Prisma.sql`d.is_featured = ${query.isFeatured}`);
    if (query.keyword) {
      const like = `%${query.keyword}%`;
      conditions.push(Prisma.sql`(d.name ILIKE ${like} OR d.description ILIKE ${like})`);
    }

    const rows = await prisma.$queryRaw<DishWithStatsRow[]>`
      SELECT
        d.id,
        d.restaurant_id  AS "restaurantId",
        d.category_id    AS "categoryId",
        d.name,
        d.slug,
        d.description,
        d.image_url      AS "imageUrl",
        d.price,
        d.is_available   AS "isAvailable",
        d.is_archived    AS "isArchived",
        d.is_featured    AS "isFeatured",
        d.sort_order     AS "sortOrder",
        d.spice_level    AS "spiceLevel",
        d.is_veg         AS "isVeg",
        d.created_at     AS "createdAt",
        d.updated_at     AS "updatedAt",
        json_build_object(
          'ratingCount',   reviews.rating_count,
          'avgRating',     reviews.avg_rating,
          'taste',         reviews.avg_taste,
          'portion',       reviews.avg_portion,
          'value',         reviews.avg_value,
          'recommendRate', CASE WHEN reviews.rating_count > 0
                                 THEN reviews.recommend_count::float / reviews.rating_count
                                 ELSE NULL END,
          'distribution',  reviews.distribution,
          'orders30d',     COALESCE(orders_current.units, 0),
          'ordersPrev30d', COALESCE(orders_previous.units, 0),
          'topTags',       COALESCE(tags.top_tags, '[]'::json)
        ) AS stats
      FROM dishes d
      -- dish_reviews has an index on (dishId); the aggregate always returns exactly
      -- one row per dish (COUNT/ARRAY default to 0, only AVG is NULL on no reviews).
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int                                  AS rating_count,
          ROUND(AVG(r.overall)::numeric, 2)::float        AS avg_rating,
          ROUND(AVG(r.taste)::numeric, 2)::float          AS avg_taste,
          ROUND(AVG(r.portion)::numeric, 2)::float        AS avg_portion,
          ROUND(AVG(r.value)::numeric, 2)::float          AS avg_value,
          COUNT(*) FILTER (WHERE r.would_order_again)::int AS recommend_count,
          ARRAY[
            COUNT(*) FILTER (WHERE r.overall = 1),
            COUNT(*) FILTER (WHERE r.overall = 2),
            COUNT(*) FILTER (WHERE r.overall = 3),
            COUNT(*) FILTER (WHERE r.overall = 4),
            COUNT(*) FILTER (WHERE r.overall = 5)
          ]::int[]                                        AS distribution
        FROM dish_reviews r
        WHERE r.dish_id = d.id AND r.is_hidden = false
      ) reviews ON true
      -- order_items has an index on (dishId); joining to orders by its primary key
      -- keeps this an index scan on the dish side, not a sequential scan on orders.
      LEFT JOIN LATERAL (
        SELECT SUM(oi.quantity)::int AS units
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.dish_id = d.id
          AND o.status <> 'CANCELLED'::"OrderStatus"
          AND o.created_at >= ${windowStart}
      ) orders_current ON true
      LEFT JOIN LATERAL (
        SELECT SUM(oi.quantity)::int AS units
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.dish_id = d.id
          AND o.status <> 'CANCELLED'::"OrderStatus"
          AND o.created_at >= ${previousWindowStart}
          AND o.created_at < ${windowStart}
      ) orders_previous ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(ranked) AS top_tags
        FROM (
          SELECT json_build_object('tag', t.label, 'count', COUNT(*)) AS ranked
          FROM dish_review_tags rt
          JOIN dish_reviews r2 ON r2.id = rt.review_id
          JOIN dish_tags t ON t.id = rt.tag_id
          WHERE r2.dish_id = d.id AND r2.is_hidden = false
          GROUP BY t.label
          ORDER BY COUNT(*) DESC, t.label ASC
          LIMIT ${TOP_TAGS_LIMIT}
        ) ranked
      ) tags ON true
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY d.sort_order ASC, d.name ASC
    `;

    return rows.map(row => ({ ...row, badges: dishBadges(row, row.stats) }));
  }
}

export default DishRepositoryImpl;
