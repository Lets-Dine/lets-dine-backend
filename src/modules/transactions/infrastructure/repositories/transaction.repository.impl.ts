import { Injectable } from "@nestjs/common";
import { DeliveryAssignmentStatus, DeliverySettlementDirection, ExpenseKind, PaymentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import { ITransaction } from "../../domain/interfaces/transaction.interface";
import {
  ISourcePage,
  ITransactionFilter,
  ITransactionScope,
  TransactionRepository,
} from "../../domain/repositories/transaction.repository";
import { ICourierRun } from "../../domain/utils/courier-fee-transactions.util";
import { ICreditLot } from "../../domain/utils/purchase-allocation.util";

const between = (f: ITransactionFilter) => (f.from || f.to ? { ...(f.from && { gte: f.from }), ...(f.to && { lte: f.to }) } : undefined);
const paid = (status: PaymentStatus | undefined) => !status || status === PaymentStatus.PAID;

@Injectable()
class TransactionRepositoryImpl implements TransactionRepository {
  constructor(private prisma: PrismaService) {}

  async fetchSales(scope: ITransactionScope, f: ITransactionFilter, take: number): Promise<ISourcePage> {
    // Sales carry a fixed category, and no supplier — a filter that cannot match them empties the source.
    if (f.supplier || (f.category && f.category !== "sales")) return { rows: [], count: 0 };
    const where: Prisma.PaymentWhereInput = {
      ...scope,
      ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : f.outstandingOnly && { paymentStatus: { not: PaymentStatus.PAID } }),
      ...(f.customerId && { customerId: f.customerId }),
      ...(between(f) && { createdAt: between(f) }),
    };
    const [found, count] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          total: true,
          paidAmount: true,
          refundedAmount: true,
          paymentStatus: true,
          createdAt: true,
          dueDate: true,
          createdByName: true,
          customerId: true,
          customer: { select: { name: true } },
          table: { select: { name: true } },
          items: { select: { dishNameSnapshot: true, quantity: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    const rows = found.map(
      (p): ITransaction => ({
        id: `PAYMENT:${p.id}`,
        type: "SALE",
        category: "sales",
        description: `${p.table?.name ?? "Delivery"} — ${p.items.map(i => `${i.quantity}× ${i.dishNameSnapshot}`).join(", ")}`,
        totalAmount: p.total,
        paidAmount: p.paidAmount,
        outstandingAmount: p.total - p.paidAmount,
        paymentStatus: p.paymentStatus,
        transactionDate: p.createdAt,
        dueDate: p.dueDate,
        counterparty: p.customer ? { kind: "CUSTOMER", id: p.customerId, name: p.customer.name } : null,
        source: { type: "PAYMENT", id: p.id },
        saleId: p.id,
        refundedAmount: p.refundedAmount,
        createdByName: p.createdByName,
      })
    );
    return { rows, count };
  }

  async fetchExpenses(scope: ITransactionScope, f: ITransactionFilter, take: number): Promise<ISourcePage> {
    // These rows are money that has already moved, so they are always PAID and never owe anyone.
    if (f.customerId || f.supplier || f.outstandingOnly || !paid(f.paymentStatus)) return { rows: [], count: 0 };
    const kinds = { EXPENSE: [ExpenseKind.EXPENSE], INCOME: [ExpenseKind.INCOME], TRANSFER: [ExpenseKind.DEPOSIT, ExpenseKind.WITHDRAWAL] }[
      f.type as "EXPENSE" | "INCOME" | "TRANSFER"
    ];
    const where: Prisma.ExpenseWhereInput = {
      ...scope,
      // The payment legs of a supplier bill, a refund or a courier settlement are not new activity — the bill and the refund are listed on their own.
      supplierPaymentId: null,
      paymentRefundId: null,
      recurringExpenseId: null,
      // A courier settlement's rows are the money side of a delivery fee, which is listed as its own transaction.
      deliverySettlementId: null,
      ...(kinds && { kind: { in: kinds } }),
      ...(f.category && { category: f.category }),
      ...(between(f) && { createdAt: between(f) }),
    };
    const [found, count] = await Promise.all([
      this.prisma.expense.findMany({ where, take, orderBy: { createdAt: "desc" } }),
      this.prisma.expense.count({ where }),
    ]);
    const rows = found.map((e): ITransaction => {
      const transfer = e.kind === ExpenseKind.DEPOSIT || e.kind === ExpenseKind.WITHDRAWAL;
      return {
        id: `EXPENSE:${e.id}`,
        type: transfer ? "TRANSFER" : e.kind === ExpenseKind.INCOME ? "INCOME" : "EXPENSE",
        category: transfer ? "transfer" : e.category,
        description: transfer
          ? e.kind === ExpenseKind.DEPOSIT
            ? "Drawer → Bank"
            : "Bank → Drawer"
          : [e.category, e.note].filter(Boolean).join(" — "),
        totalAmount: e.amount,
        paidAmount: e.amount,
        outstandingAmount: 0,
        paymentStatus: PaymentStatus.PAID,
        transactionDate: e.createdAt,
        dueDate: null,
        counterparty: null,
        source: { type: "EXPENSE", id: e.id },
        saleId: null,
        refundedAmount: 0,
        createdByName: e.createdByName,
      };
    });
    return { rows, count };
  }

  async fetchRefunds(scope: ITransactionScope, f: ITransactionFilter, take: number): Promise<ISourcePage> {
    if (f.supplier || f.outstandingOnly || !paid(f.paymentStatus) || (f.category && f.category !== "refund")) return { rows: [], count: 0 };
    const where: Prisma.PaymentRefundWhereInput = {
      ...scope,
      ...(f.customerId && { payment: { customerId: f.customerId } }),
      ...(between(f) && { createdAt: between(f) }),
    };
    const [found, count] = await Promise.all([
      this.prisma.paymentRefund.findMany({
        where,
        take,
        orderBy: { createdAt: "desc" },
        include: { payment: { select: { customerId: true, customer: { select: { name: true } } } } },
      }),
      this.prisma.paymentRefund.count({ where }),
    ]);
    const rows = found.map(
      (r): ITransaction => ({
        id: `PAYMENT_REFUND:${r.id}`,
        type: "REFUND",
        category: "refund",
        description: r.reason || "Refund",
        totalAmount: r.amount,
        paidAmount: r.amount,
        outstandingAmount: 0,
        paymentStatus: PaymentStatus.PAID,
        transactionDate: r.createdAt,
        dueDate: null,
        counterparty: r.payment.customer ? { kind: "CUSTOMER", id: r.payment.customerId, name: r.payment.customer.name } : null,
        // Traceable to the sale it reverses.
        source: { type: "PAYMENT_REFUND", id: r.id },
        saleId: r.paymentId,
        refundedAmount: 0,
        createdByName: r.createdByName,
      })
    );
    return { rows, count };
  }

  async fetchCreditLots({
    restaurantId,
    branchId,
  }: ITransactionScope): Promise<{ lots: (ICreditLot & { ingredient: string; unit: string })[]; settled: Map<string, number> }> {
    const [lots, payments, returns] = await Promise.all([
      this.prisma.stockLot.findMany({
        where: { onCredit: true, fromTransfer: false, supplier: { not: null }, cost: { gt: 0 }, ingredient: { branchId } },
        select: { id: true, supplier: true, cost: true, receivedAt: true, ingredient: { select: { name: true, unit: true } } },
      }),
      this.prisma.supplierPayment.groupBy({ by: ["supplier"], where: { restaurantId, branchId }, _sum: { amount: true } }),
      this.prisma.supplierReturn.groupBy({ by: ["supplier"], where: { branchId }, _sum: { owedOffset: true } }),
    ]);
    const settled = new Map<string, number>();
    for (const g of payments) settled.set(g.supplier.toLowerCase(), (settled.get(g.supplier.toLowerCase()) ?? 0) + (g._sum.amount ?? 0));
    for (const g of returns) settled.set(g.supplier.toLowerCase(), (settled.get(g.supplier.toLowerCase()) ?? 0) + (g._sum.owedOffset ?? 0));
    return {
      lots: lots.map(l => ({
        id: l.id,
        supplier: l.supplier as string,
        cost: l.cost as number,
        receivedAt: l.receivedAt,
        ingredient: l.ingredient.name,
        unit: l.ingredient.unit,
      })),
      settled,
    };
  }

  async fetchCourierRuns({ restaurantId, branchId }: ITransactionScope): Promise<{ runs: ICourierRun[]; settled: Map<string, number> }> {
    const [runs, settlements] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where: { restaurantId, branchId, status: DeliveryAssignmentStatus.DELIVERED, courierFee: { gt: 0 } },
        select: {
          id: true,
          accountKind: true,
          accountId: true,
          courierFee: true,
          deliveredAt: true,
          createdAt: true,
          order: { select: { reference: true } },
          rider: { select: { name: true } },
          partner: { select: { name: true } },
        },
      }),
      this.prisma.deliverySettlement.groupBy({
        by: ["accountId", "direction"],
        where: { restaurantId, branchId },
        _sum: { amount: true, offset: true },
      }),
    ]);
    // The delivery ledger's own rule: fees owed = fees earned − payouts − everything netted off.
    const settled = new Map<string, number>();
    for (const g of settlements) {
      const cleared = (g.direction === DeliverySettlementDirection.PAYOUT ? (g._sum.amount ?? 0) : 0) + (g._sum.offset ?? 0);
      settled.set(g.accountId, (settled.get(g.accountId) ?? 0) + cleared);
    }
    return {
      runs: runs.map(r => ({
        id: r.id,
        supplier: r.accountId,
        cost: r.courierFee,
        receivedAt: r.deliveredAt ?? r.createdAt,
        orderReference: r.order.reference,
        accountKind: r.accountKind,
        accountName: r.partner?.name ?? r.rider?.name ?? "Courier",
      })),
      settled,
    };
  }

  async sumReceivables(scope: ITransactionScope, now: Date): Promise<{ outstanding: number; overdue: number; count: number }> {
    const open = { ...scope, paymentStatus: { not: PaymentStatus.PAID } };
    const [all, late] = await Promise.all([
      this.prisma.payment.aggregate({ where: open, _sum: { total: true, paidAmount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { ...open, dueDate: { lt: now } }, _sum: { total: true, paidAmount: true } }),
    ]);
    return {
      outstanding: (all._sum.total ?? 0) - (all._sum.paidAmount ?? 0),
      overdue: (late._sum.total ?? 0) - (late._sum.paidAmount ?? 0),
      count: all._count._all,
    };
  }
}

export default TransactionRepositoryImpl;
