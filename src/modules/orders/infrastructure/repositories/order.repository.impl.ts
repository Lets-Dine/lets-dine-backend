import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import {
  IOrderCreate,
  IOrdersFetchOptions,
  IOrdersFetchQuery,
  IOrderUpdate,
  OrderFetchOptions,
  OrderRepository,
} from "../../domain/repositories/order.repository";

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
