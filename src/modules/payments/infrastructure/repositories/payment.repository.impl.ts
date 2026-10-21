import { Injectable } from "@nestjs/common";
import { ExpenseKind, Prisma, TenderStatus } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPaymentRefund, IPaymentsSummary, IPaymentTender, IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import {
  IActor,
  IPaymentCreate,
  IRefundCreate,
  ITenderCreate,
  IPaymentsFetchOptions,
  IPaymentsFetchQuery,
  PaymentRepository,
} from "../../domain/repositories/payment.repository";

const TENDER_SELECT = {
  id: true,
  paymentId: true,
  amount: true,
  method: true,
  status: true,
  reference: true,
  paidAt: true,
  createdByName: true,
} satisfies Prisma.PaymentTenderSelect;
const REFUND_SELECT = {
  id: true,
  paymentId: true,
  tenderId: true,
  amount: true,
  method: true,
  reason: true,
  createdAt: true,
  createdByName: true,
} satisfies Prisma.PaymentRefundSelect;

const WITH_CUSTOMER = {
  items: true,
  customer: { select: { name: true } },
  tenders: { select: TENDER_SELECT, orderBy: { paidAt: "asc" } },
  refunds: { select: REFUND_SELECT, orderBy: { createdAt: "asc" } },
} satisfies Prisma.PaymentInclude;

/** Flattens the joined customer to `customerName`, so the receipt needs no nested object. */
function withCustomerName<T extends { customer: { name: string } | null }>({
  customer,
  ...payment
}: T): Omit<T, "customer"> & { customerName: string | null } {
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
    const { items, tenders, ...payment } = data;
    return withCustomerName(
      await prisma.payment.create({
        data: {
          ...payment,
          items: { create: items },
          tenders: {
            create: tenders.map(t => ({
              ...t,
              restaurantId: data.restaurantId,
              branchId: data.branchId,
              createdBy: data.createdBy,
              createdByName: data.createdByName,
            })),
          },
        },
        include: WITH_CUSTOMER,
      })
    );
  }

  private whereOf(query: IPaymentsFetchQuery): Prisma.PaymentWhereInput {
    return {
      restaurantId: query.restaurantId,
      branchId: query.branchId,
      ...(query.tableId && { tableId: query.tableId }),
      ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(query.method && { tenders: { some: { method: query.method, status: TenderStatus.SUCCEEDED } } }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };
  }

  async summarize(query: IPaymentsFetchQuery): Promise<IPaymentsSummary> {
    const sum = await this.prisma.payment.aggregate({ where: this.whereOf(query), _count: { _all: true }, _sum: { total: true, paidAmount: true, refundedAmount: true } });
    const sold = sum._sum.total ?? 0;
    const collected = sum._sum.paidAmount ?? 0;
    return { count: sum._count._all, sold, collected, refunded: sum._sum.refundedAmount ?? 0, owed: sold - collected };
  }

  async fetchAll(query: IPaymentsFetchQuery, options?: IPaymentsFetchOptions): Promise<PaginatedResponse<IPaymentWithItems>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});

    const where = this.whereOf(query);

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

  async findById(
    id: string,
    restaurantId: string,
    branchId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IPaymentWithItems | null> {
    const found = await (options?.tx ?? this.prisma).payment.findFirst({ where: { id, restaurantId, branchId }, include: WITH_CUSTOMER });
    return found && withCustomerName(found);
  }

  async findByIdempotencyKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems | null> {
    const found = await (options?.tx ?? this.prisma).payment.findFirst({
      where: { restaurantId, idempotencyKey: key },
      include: WITH_CUSTOMER,
    });
    return found && withCustomerName(found);
  }

  async findTenderByKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentTender | null> {
    return (options?.tx ?? this.prisma).paymentTender.findFirst({ where: { restaurantId, idempotencyKey: key }, select: TENDER_SELECT });
  }

  async findRefundByKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentRefund | null> {
    return (options?.tx ?? this.prisma).paymentRefund.findFirst({ where: { restaurantId, idempotencyKey: key }, select: REFUND_SELECT });
  }

  async addTender(
    paymentId: string,
    actor: IActor,
    tender: ITenderCreate,
    options: { tx: PrismaTransaction }
  ): Promise<IPaymentTender | null> {
    const { tx } = options;
    // One conditional UPDATE is the lock: it only matches while the new total still fits, and Postgres
    // serialises concurrent writers on the row, so the loser re-checks against the winner's paid_amount.
    const moved = await tx.$executeRaw`
      UPDATE "public"."payments"
      SET "paid_amount" = "paid_amount" + ${tender.amount},
          "payment_status" = CASE WHEN "paid_amount" + ${tender.amount} >= "total" THEN 'PAID'::"public"."PaymentStatus" ELSE 'PARTIALLY_PAID'::"public"."PaymentStatus" END
      WHERE "id" = ${paymentId}::uuid AND "restaurant_id" = ${actor.restaurantId}::uuid AND "branch_id" = ${actor.branchId}::uuid
        AND "paid_amount" + ${tender.amount} <= "total"`;
    if (moved === 0) return null;
    return tx.paymentTender.create({
      data: {
        ...tender,
        paymentId,
        restaurantId: actor.restaurantId,
        branchId: actor.branchId,
        createdBy: actor.createdBy,
        createdByName: actor.createdByName,
      },
      select: TENDER_SELECT,
    });
  }

  async addRefund(
    paymentId: string,
    actor: IActor,
    refund: IRefundCreate,
    options: { tx: PrismaTransaction }
  ): Promise<IPaymentRefund | null> {
    const { tx } = options;
    const moved = await tx.$executeRaw`
      UPDATE "public"."payments" SET "refunded_amount" = "refunded_amount" + ${refund.amount}
      WHERE "id" = ${paymentId}::uuid AND "restaurant_id" = ${actor.restaurantId}::uuid AND "branch_id" = ${actor.branchId}::uuid
        AND "refunded_amount" + ${refund.amount} <= "paid_amount"`;
    if (moved === 0) return null;
    const created = await tx.paymentRefund.create({
      data: {
        ...refund,
        paymentId,
        restaurantId: actor.restaurantId,
        branchId: actor.branchId,
        createdBy: actor.createdBy,
        createdByName: actor.createdByName,
      },
      select: REFUND_SELECT,
    });
    // The money leaves now, so the cash book hears about it now — through the same Expense row suppliers use.
    await tx.expense.create({
      data: {
        paymentRefundId: created.id,
        restaurantId: actor.restaurantId,
        branchId: actor.branchId,
        kind: ExpenseKind.EXPENSE,
        amount: refund.amount,
        method: refund.method,
        category: "refund",
        note: refund.reason,
        createdBy: actor.createdBy,
        createdByName: actor.createdByName,
      },
    });
    return created;
  }

  async findBySessionId(sessionId: string): Promise<IPaymentWithItems | null> {
    const found = await this.prisma.payment.findFirst({ where: { sessionId }, orderBy: { createdAt: "desc" }, include: WITH_CUSTOMER });
    return found && withCustomerName(found);
  }
}

export default PaymentRepositoryImpl;
