import { Injectable } from "@nestjs/common";
import { ExpenseKind, InvoiceSeries, Prisma, TenderStatus } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { fiscalYearOf } from "../../domain/utils/fiscal-year.util";
import {
  IPaymentRegister,
  IPaymentRefund,
  IPaymentsSummary,
  IPaymentTender,
  IPaymentWithItems,
} from "../../domain/interfaces/payment.interface";
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
  fiscalYear: true,
  creditNoteNumber: true,
  taxReversed: true,
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

/**
 * The next number in a restaurant's gapless series for a fiscal year. One atomic upsert, and it runs in the caller's
 * transaction, so concurrent bills queue on the counter row and a rollback hands the number back.
 */
async function nextNumber(tx: PrismaTransaction, restaurantId: string, fiscalYear: string, series: InvoiceSeries): Promise<number> {
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "public"."invoice_counters" ("restaurant_id", "fiscal_year", "series", "last")
    VALUES (${restaurantId}::uuid, ${fiscalYear}, ${series}::"public"."InvoiceSeries", 1)
    ON CONFLICT ("restaurant_id", "fiscal_year", "series") DO UPDATE SET "last" = "invoice_counters"."last" + 1
    RETURNING "last"`;
  return row.last;
}

@Injectable()
class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems> {
    // The number must commit or roll back with the bill, so a caller without a transaction gets one here.
    if (!options?.tx) return this.prisma.$transaction(tx => this.create(data, { tx }));
    const prisma = options.tx;
    const { items, tenders, ...payment } = data;
    // Every bill is an IRD invoice, so numbering lives here, where every way of creating one passes, and not in each caller.
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: data.restaurantId },
      select: { timezone: true },
    });
    // The rate is read back from what was charged, not from the restaurant's setting: a branch can override the rate, and
    // the receipt and register must describe the bill as it was made.
    const taxable = data.subtotal - data.discount + data.serviceCharge;
    const taxRate = data.tax > 0 && taxable > 0 ? Math.round((data.tax / taxable) * 10000) / 10000 : 0;
    const fiscalYear = fiscalYearOf(new Date(), restaurant.timezone);
    const invoiceNumber = await nextNumber(prisma, data.restaurantId, fiscalYear, InvoiceSeries.INVOICE);
    return withCustomerName(
      await prisma.payment.create({
        data: {
          ...payment,
          fiscalYear,
          invoiceNumber,
          taxRate,
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
    const sum = await this.prisma.payment.aggregate({
      where: this.whereOf(query),
      _count: { _all: true },
      _sum: { total: true, paidAmount: true, refundedAmount: true },
    });
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
    // A refund is a credit note against the invoice: its own number, and the VAT it hands back. A bill from before numbering
    // has no invoice to reverse, so its refunds stay unnumbered rather than point at "null".
    const [original, restaurant] = await Promise.all([
      tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { tax: true, total: true, invoiceNumber: true, refundedAmount: true },
      }),
      tx.restaurant.findUniqueOrThrow({ where: { id: actor.restaurantId }, select: { timezone: true } }),
    ]);
    const fiscalYear = original.invoiceNumber === null ? null : fiscalYearOf(new Date(), restaurant.timezone);
    const creditNoteNumber = fiscalYear === null ? null : await nextNumber(tx, actor.restaurantId, fiscalYear, InvoiceSeries.CREDIT_NOTE);
    // Cumulative rounding: the VAT handed back over all refunds always adds up to exactly the VAT charged, however it was split.
    const vatUpTo = (refunded: number) => (original.total > 0 ? Math.round((refunded * original.tax) / original.total) : 0);
    const taxReversed = vatUpTo(original.refundedAmount) - vatUpTo(original.refundedAmount - refund.amount);
    const created = await tx.paymentRefund.create({
      data: {
        ...refund,
        fiscalYear,
        creditNoteNumber,
        taxReversed,
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

  async recordPrint(paymentId: string, restaurantId: string, branchId: string): Promise<number | null> {
    const moved = await this.prisma.payment.updateManyAndReturn({
      where: { id: paymentId, restaurantId, branchId },
      data: { printCount: { increment: 1 } },
      select: { printCount: true },
    });
    return moved[0]?.printCount ?? null;
  }

  async register(restaurantId: string, year?: string): Promise<IPaymentRegister> {
    const { timezone } = await this.prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { timezone: true } });
    const fiscalYear = year ?? fiscalYearOf(new Date(), timezone);
    const [payments, refunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: { restaurantId, fiscalYear, invoiceNumber: { not: null } },
        orderBy: { invoiceNumber: "asc" },
      }),
      this.prisma.paymentRefund.findMany({
        where: { restaurantId, fiscalYear, creditNoteNumber: { not: null } },
        orderBy: { creditNoteNumber: "asc" },
        include: { payment: { select: { fiscalYear: true, invoiceNumber: true, buyerName: true, buyerPan: true } } },
      }),
    ]);
    return {
      sales: payments.map(p => {
        // VAT is charged on the discounted subtotal plus service charge (see `calculateOrderTotals`); a bill with no VAT is all exempt.
        const taxed = p.tax > 0;
        return {
          number: `${p.fiscalYear}-${p.invoiceNumber}`,
          against: null,
          issuedAt: p.createdAt,
          buyerName: p.buyerName,
          buyerPan: p.buyerPan,
          total: p.total,
          // Whatever carried no VAT: the whole bill when none was charged, or a delivery fee on top of a taxed one.
          exempt: taxed ? p.total - (p.subtotal - p.discount + p.serviceCharge) - p.tax : p.total,
          taxable: taxed ? p.subtotal - p.discount + p.serviceCharge : 0,
          vat: p.tax,
        };
      }),
      returns: refunds.map(r => ({
        number: `${r.fiscalYear}-${r.creditNoteNumber}`,
        against: `${r.payment.fiscalYear}-${r.payment.invoiceNumber}`,
        issuedAt: r.createdAt,
        buyerName: r.payment.buyerName,
        buyerPan: r.payment.buyerPan,
        total: r.amount,
        exempt: r.taxReversed > 0 ? 0 : r.amount,
        taxable: r.taxReversed > 0 ? r.amount - r.taxReversed : 0,
        vat: r.taxReversed,
      })),
    };
  }

  async billedItems(sessionId: string, options?: { tx?: PrismaTransaction }): Promise<{ orderItemId: string | null; quantity: number }[]> {
    const rows = await (options?.tx ?? this.prisma).paymentItem.groupBy({
      by: ["orderItemId"],
      where: { payment: { sessionId } },
      _sum: { quantity: true },
    });
    return rows.map(row => ({ orderItemId: row.orderItemId, quantity: row._sum.quantity ?? 0 }));
  }

  async findBySessionId(sessionId: string): Promise<IPaymentWithItems | null> {
    const found = await this.prisma.payment.findFirst({ where: { sessionId }, orderBy: { createdAt: "desc" }, include: WITH_CUSTOMER });
    return found && withCustomerName(found);
  }
}

export default PaymentRepositoryImpl;
