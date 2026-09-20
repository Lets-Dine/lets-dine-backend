import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import {
  IOrderCreate,
  IOrderItemCreate,
  IOrdersFetchOptions,
  IOrdersFetchQuery,
  IOrderTotalsUpdate,
  IOrderUpdate,
  OrderFetchOptions,
  OrderRepository,
} from "../../domain/repositories/order.repository";
import { OPEN_ORDER_STATUSES } from "../../domain/utils/order-status.util";

const FIRST_REFERENCE = 1000;

/**
 * `reviews` is included purely as a projection of this order's own reviews —
 * which of its dishes have been rated (§10). It is read, never written, here.
 */
const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" as const } },
  table: { select: { name: true } },
  reviews: { select: { dishId: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
class OrderRepositoryImpl implements OrderRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null> {
    const prisma = options?.tx ?? this.prisma;
    const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    return order ? this.toOrder(order) : null;
  }

  async findByIdempotencyKey(key: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null> {
    const prisma = options?.tx ?? this.prisma;
    const order = await prisma.order.findUnique({ where: { idempotencyKey: key }, include: ORDER_INCLUDE });
    return order ? this.toOrder(order) : null;
  }

  async nextReference(restaurantId: string, options?: OrderFetchOptions): Promise<string> {
    const prisma = options?.tx ?? this.prisma;
    const placed = await prisma.order.count({ where: { restaurantId } });
    return `#${FIRST_REFERENCE + placed + 1}`;
  }

  async create(data: IOrderCreate, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems> {
    const prisma = options?.tx ?? this.prisma;
    const { items, ...order } = data;

    const created = await prisma.order.create({
      data: {
        ...order,
        reference: await this.nextReference(order.restaurantId, options),
        items: { create: items.map(item => ({ ...item, notes: item.notes ?? "" })) },
      },
      include: ORDER_INCLUDE,
    });

    return this.toOrder(created);
  }

  async update(id: string, data: IOrderUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IOrderWithItems> {
    const prisma = options?.tx ?? this.prisma;
    const order = await prisma.order.update({
      where: { id },
      data: { ...data, updatedBy: options?.actorId },
      include: ORDER_INCLUDE,
    });
    return this.toOrder(order);
  }

  async fetchAll(query: IOrdersFetchQuery, options?: IOrdersFetchOptions): Promise<PaginatedResponse<IOrderWithItems>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt" | "total" | "status">(options ?? {});

    const where: Prisma.OrderWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.sessionId && { sessionId: query.sessionId }),
      ...(query.tableId && { tableId: query.tableId }),
      ...(query.statuses?.length && { status: { in: query.statuses } }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.order.findMany({
            where,
            include: ORDER_INCLUDE,
            ...paginationQuery,
            orderBy: orderBy ?? { createdAt: "desc" },
          }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.order.count({ where }),
    ]);

    return { rows: rows.map(row => this.toOrder(row)), count: count ?? 0 };
  }

  /**
   * The ORM path (`fetchAll` with `include`) issues a query per relation per
   * page of orders. A session's order list is read on a hot path — the diner
   * polling their own tab, staff opening a table's bill — so this goes
   * straight to SQL instead: one query, items and reviewed-dish ids folded in
   * via lateral joins rather than fetched separately.
   */
  async findBySessionId(sessionId: string, restaurantId: string): Promise<IOrderWithItems[]> {
    return this.prisma.$queryRaw<IOrderWithItems[]>`
      SELECT
        o.id,
        o.reference,
        o.restaurant_id   AS "restaurantId",
        o.table_id        AS "tableId",
        o.session_id      AS "sessionId",
        o.status,
        o.subtotal,
        o.service_charge  AS "serviceCharge",
        o.tax,
        o.discount,
        o.total,
        o.currency,
        o.idempotency_key AS "idempotencyKey",
        o.cancel_reason   AS "cancelReason",
        o.completed_at    AS "completedAt",
        o.created_at      AS "createdAt",
        o.updated_at      AS "updatedAt",
        t.name            AS "tableName",
        COALESCE(items.rows, '[]'::json)             AS items,
        COALESCE(reviews.dish_ids, ARRAY[]::uuid[])  AS "reviewedDishIds"
      FROM lets_dine.orders o
      JOIN lets_dine.dining_tables t ON t.id = o.table_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
                 json_build_object(
                   'id', oi.id,
                   'orderId', oi.order_id,
                   'dishId', oi.dish_id,
                   'dishNameSnapshot', oi.dish_name_snapshot,
                   'imageUrlSnapshot', oi.image_url_snapshot,
                   'unitPrice', oi.unit_price,
                   'quantity', oi.quantity,
                   'notes', oi.notes
                 )
                 ORDER BY oi.created_at ASC
               ) AS rows
        FROM lets_dine.order_items oi
        WHERE oi.order_id = o.id
      ) items ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT dr.dish_id) AS dish_ids
        FROM lets_dine.dish_reviews dr
        WHERE dr.order_id = o.id
      ) reviews ON true
      -- both sides of the WHERE are indexed (orders_sessionId_idx, orders_restaurantId_status_idx's
      -- leading column) so this is an index scan, not a sequential one.
      WHERE o.session_id = ${sessionId}::uuid
        AND o.restaurant_id = ${restaurantId}::uuid
      ORDER BY o.created_at DESC
    `;
  }

  async findLatestByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null> {
    const prisma = options?.tx ?? this.prisma;
    const order = await prisma.order.findFirst({
      where: { tableId, restaurantId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return order ? this.toOrder(order) : null;
  }

  async findOpenByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems[]> {
    const prisma = options?.tx ?? this.prisma;
    const orders = await prisma.order.findMany({
      where: { tableId, restaurantId, status: { in: OPEN_ORDER_STATUSES } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return orders.map(order => this.toOrder(order));
  }

  async replaceItems(
    orderId: string,
    items: IOrderItemCreate[],
    totals: IOrderTotalsUpdate,
    options?: { tx?: PrismaTransaction }
  ): Promise<IOrderWithItems> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.orderItem.deleteMany({ where: { orderId } });
    if (items.length > 0) {
      await prisma.orderItem.createMany({
        data: items.map(item => ({ ...item, notes: item.notes ?? "", orderId })),
      });
    }
    const order = await prisma.order.update({ where: { id: orderId }, data: totals, include: ORDER_INCLUDE });
    return this.toOrder(order);
  }

  async settleOpenByTableId(tableId: string, restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems[]> {
    const prisma = options?.tx ?? this.prisma;
    const open = await prisma.order.findMany({
      where: { tableId, restaurantId, status: { in: OPEN_ORDER_STATUSES } },
      select: { id: true },
    });
    if (open.length === 0) return [];

    const ids = open.map(order => order.id);
    await prisma.order.updateMany({ where: { id: { in: ids } }, data: { status: "COMPLETED", completedAt: new Date() } });

    const orders = await prisma.order.findMany({ where: { id: { in: ids } }, include: ORDER_INCLUDE, orderBy: { createdAt: "asc" } });
    return orders.map(order => this.toOrder(order));
  }

  async settleOpenBySessionId(sessionId: string, restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const { count } = await prisma.order.updateMany({
      where: { sessionId, restaurantId, status: { in: OPEN_ORDER_STATUSES } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return count;
  }

  private toOrder(order: OrderRow): IOrderWithItems {
    const { table, reviews, items, ...rest } = order;

    return {
      ...rest,
      items,
      tableName: table.name,
      reviewedDishIds: [...new Set(reviews.map(review => review.dishId))],
    };
  }
}

export default OrderRepositoryImpl;
