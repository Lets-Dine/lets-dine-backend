import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import {
  IPaymentCreate,
  IPaymentsFetchOptions,
  IPaymentsFetchQuery,
  PaymentRepository,
} from "../../domain/repositories/payment.repository";

@Injectable()
class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems> {
    const prisma = options?.tx ?? this.prisma;
    const { items, ...payment } = data;
    return prisma.payment.create({
      data: { ...payment, items: { create: items } },
      include: { items: true },
    });
  }

  async fetchAll(query: IPaymentsFetchQuery, options?: IPaymentsFetchOptions): Promise<PaginatedResponse<IPaymentWithItems>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});

    const where: Prisma.PaymentWhereInput = {
      restaurantId: query.restaurantId,
      ...(query.tableId && { tableId: query.tableId }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.payment.findMany({ where, ...paginationQuery, orderBy: orderBy ?? { createdAt: "desc" }, include: { items: true } }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.payment.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }

  async findById(id: string, restaurantId: string): Promise<IPaymentWithItems | null> {
    return this.prisma.payment.findFirst({ where: { id, restaurantId }, include: { items: true } });
  }

  async findBySessionId(sessionId: string): Promise<IPaymentWithItems | null> {
    return this.prisma.payment.findFirst({ where: { sessionId }, orderBy: { createdAt: "desc" }, include: { items: true } });
  }
}

export default PaymentRepositoryImpl;
