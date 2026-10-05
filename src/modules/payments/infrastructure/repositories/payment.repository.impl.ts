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

const WITH_CUSTOMER = { items: true, customer: { select: { name: true } } } satisfies Prisma.PaymentInclude;

/** Flattens the joined customer to `customerName`, so the receipt needs no nested object. */
function withCustomerName<T extends { customer: { name: string } | null }>({ customer, ...payment }: T): Omit<T, "customer"> & { customerName: string | null } {
  return { ...payment, customerName: customer?.name ?? null };
}

@Injectable()
class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems> {
    const prisma = options?.tx ?? this.prisma;
    const { items, ...payment } = data;
    return withCustomerName(
      await prisma.payment.create({
        data: { ...payment, items: { create: items } },
        include: WITH_CUSTOMER,
      })
    );
  }

  async fetchAll(query: IPaymentsFetchQuery, options?: IPaymentsFetchOptions): Promise<PaginatedResponse<IPaymentWithItems>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});

    const where: Prisma.PaymentWhereInput = {
      restaurantId: query.restaurantId,
      branchId: query.branchId,
      ...(query.tableId && { tableId: query.tableId }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.payment
            .findMany({ where, ...paginationQuery, orderBy: orderBy ?? { createdAt: "desc" }, include: WITH_CUSTOMER })
            .then(found => found.map(withCustomerName)),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.payment.count({ where }),
    ]);

    return { rows, count: count ?? 0 };
  }

  async findById(id: string, restaurantId: string, branchId: string): Promise<IPaymentWithItems | null> {
    const found = await this.prisma.payment.findFirst({ where: { id, restaurantId, branchId }, include: WITH_CUSTOMER });
    return found && withCustomerName(found);
  }

  async findBySessionId(sessionId: string): Promise<IPaymentWithItems | null> {
    const found = await this.prisma.payment.findFirst({ where: { sessionId }, orderBy: { createdAt: "desc" }, include: WITH_CUSTOMER });
    return found && withCustomerName(found);
  }
}

export default PaymentRepositoryImpl;
