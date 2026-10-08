import { Injectable } from "@nestjs/common";
import { Invoice, InvoiceKind, Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IInvoice, IInvoiceLine } from "../../domain/interfaces/billing.interface";
import {
  IInvoiceCreate,
  IInvoiceFetchOptions,
  IInvoiceFetchQuery,
  IInvoiceOptions,
  IInvoicePayment,
  InvoiceRepository,
} from "../../domain/repositories/invoice.repository";

/** `lines` is JSON in the database; it is only ever written from `IInvoiceLine[]`, so the cast back is safe. */
const toInvoice = (row: Invoice): IInvoice => ({ ...row, lines: row.lines as unknown as IInvoiceLine[] });

@Injectable()
class InvoiceRepositoryImpl implements InvoiceRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async create(data: IInvoiceCreate, options?: IInvoiceOptions): Promise<IInvoice> {
    const prisma = options?.tx ?? this.prisma;
    const row = await prisma.invoice.create({ data: { ...data, lines: data.lines as unknown as Prisma.InputJsonValue } });
    return toInvoice(row);
  }

  async findById(id: string, options?: IInvoiceOptions): Promise<IInvoice | null> {
    const prisma = options?.tx ?? this.prisma;
    const row = await prisma.invoice.findUnique({ where: { id } });
    return row ? toInvoice(row) : null;
  }

  async fetchAll(query: IInvoiceFetchQuery, options?: IInvoiceFetchOptions): Promise<PaginatedResponse<IInvoice>> {
    const prisma = options?.tx ?? this.prisma;
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt" | "dueAt" | "amount">(options ?? {});
    const where: Prisma.InvoiceWhereInput = {
      ...(query.restaurantId && { restaurantId: query.restaurantId }),
      ...(query.status && { status: query.status }),
    };

    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : prisma.invoice.findMany({ where, ...paginationQuery, orderBy: orderBy ?? { createdAt: "desc" } }),
      options?.returnCount === false ? Promise.resolve(-1) : prisma.invoice.count({ where }),
    ]);

    return { rows: rows.map(toInvoice), count };
  }

  async markPaidIfOpen(id: string, payment: IInvoicePayment, options?: IInvoiceOptions): Promise<boolean> {
    const prisma = options?.tx ?? this.prisma;
    const { count } = await prisma.invoice.updateMany({ where: { id, status: "OPEN" }, data: { ...payment, status: "PAID" } });
    return count === 1;
  }

  async recordAsExpense(invoice: IInvoice, options?: IInvoiceOptions): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    const branch = await prisma.branch.findFirst({ where: { restaurantId: invoice.restaurantId, isDefault: true }, select: { id: true } });
    if (!branch) return;
    await prisma.expense.create({
      data: {
        restaurantId: invoice.restaurantId,
        branchId: branch.id,
        kind: "EXPENSE",
        amount: invoice.amount,
        method: invoice.paymentMethod === "cash" ? "CASH" : "CARD",
        category: "Subscription",
        note: `${invoice.number} · ${invoice.lines[0]?.description ?? "FeastoX plan"}`,
        createdByName: "FeastoX billing",
      },
    });
  }

  async voidOpenForSubscription(subscriptionId: string, options?: IInvoiceOptions & { exceptId?: string; kind?: InvoiceKind }): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    const { count } = await prisma.invoice.updateMany({
      where: { subscriptionId, status: "OPEN", ...(options?.kind && { kind: options.kind }), ...(options?.exceptId && { id: { not: options.exceptId } }) },
      data: { status: "VOID" },
    });
    return count;
  }
}

export default InvoiceRepositoryImpl;
