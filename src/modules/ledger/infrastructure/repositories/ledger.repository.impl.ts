import { Injectable } from "@nestjs/common";
import { ExpenseKind, PaymentMethod, Prisma, TenderStatus } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { ICashClose, IExpense, IPeriodTotals, ISaleLine } from "../../domain/interfaces/ledger.interface";
import { ICashCloseCreate, IExpenseCreate, ILedgerScope, LedgerRepository } from "../../domain/repositories/ledger.repository";

/** Sum of `total`/`amount` over a groupBy result; `cash` picks the drawer rows, otherwise everything off-cash (card, QR, …) — the bank. */
function sumSide(
  rows: { method: PaymentMethod; kind?: ExpenseKind; _sum: { amount?: number | null } }[],
  cash: boolean,
  kind?: ExpenseKind
): number {
  return rows
    .filter(r => (r.method === PaymentMethod.CASH) === cash && (kind === undefined || r.kind === kind))
    .reduce((total, r) => total + (r._sum.amount ?? 0), 0);
}

@Injectable()
class LedgerRepositoryImpl implements LedgerRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findLastClose(scope: ILedgerScope, options?: { tx?: PrismaTransaction }): Promise<ICashClose | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.cashClose.findFirst({ where: scope, orderBy: { closedAt: "desc" } });
  }

  async findLastCloseAtOrBefore(scope: ILedgerScope, at: Date): Promise<ICashClose | null> {
    return this.prisma.cashClose.findFirst({ where: { ...scope, closedAt: { lte: at } }, orderBy: { closedAt: "desc" } });
  }

  async countCloses(scope: ILedgerScope, options?: { tx?: PrismaTransaction }): Promise<number> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.cashClose.count({ where: scope });
  }

  async deleteClose(id: string, options?: { tx?: PrismaTransaction }): Promise<void> {
    const prisma = options?.tx ?? this.prisma;
    await prisma.cashClose.delete({ where: { id } });
  }

  async findBranchTimezone(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
    return branch?.timezone ?? "Asia/Kathmandu";
  }

  async sumPeriod(scope: ILedgerScope, since: Date | null, until: Date, options?: { tx?: PrismaTransaction }): Promise<IPeriodTotals> {
    const prisma = options?.tx ?? this.prisma;
    const createdAt = { ...(since && { gt: since }), lte: until };

    // Money in is what was actually collected (successful tenders, by the moment they were taken) — never the sale's total,
    // so a credit sale adds nothing until it is paid and a later settlement lands in the period it was settled.
    const [sales, expenses] = await Promise.all([
      prisma.paymentTender.groupBy({
        by: ["method"],
        where: { ...scope, status: TenderStatus.SUCCEEDED, paidAt: createdAt },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({ by: ["method", "kind"], where: { ...scope, createdAt }, _sum: { amount: true } }),
    ]);

    return {
      cashSales: sumSide(sales, true),
      cardSales: sumSide(sales, false),
      cashExpenses: sumSide(expenses, true, ExpenseKind.EXPENSE),
      cardExpenses: sumSide(expenses, false, ExpenseKind.EXPENSE),
      cashIncome: sumSide(expenses, true, ExpenseKind.INCOME),
      cardIncome: sumSide(expenses, false, ExpenseKind.INCOME),
      deposits: sumSide(expenses, true, ExpenseKind.DEPOSIT),
      withdrawals: sumSide(expenses, true, ExpenseKind.WITHDRAWAL),
    };
  }

  /** One line per successful collection — a split bill is two lines, a settled credit sale shows when it was settled. */
  async fetchSales(scope: ILedgerScope, since: Date | null, until?: Date): Promise<ISaleLine[]> {
    const rows = await this.prisma.paymentTender.findMany({
      where: {
        ...scope,
        status: TenderStatus.SUCCEEDED,
        ...((since || until) && { paidAt: { ...(since && { gt: since }), ...(until && { lte: until }) } }),
      },
      orderBy: { paidAt: "asc" },
      select: {
        id: true,
        paidAt: true,
        amount: true,
        method: true,
        paymentId: true,
        reference: true,
        payment: { select: { table: { select: { name: true } }, items: { select: { dishNameSnapshot: true, quantity: true } } } },
      },
    });
    return rows.map(({ payment, paidAt, amount, ...tender }) => ({
      ...tender,
      createdAt: paidAt,
      total: amount,
      tableName: payment.table?.name ?? null,
      items: payment.items,
    }));
  }

  async fetchAllExpenses(scope: ILedgerScope, since: Date | null, until?: Date): Promise<IExpense[]> {
    const createdAt = { ...(since && { gt: since }), ...(until && { lte: until }) };
    return this.prisma.expense.findMany({ where: { ...scope, ...((since || until) && { createdAt }) }, orderBy: { createdAt: "asc" } });
  }

  async createClose(data: ICashCloseCreate, options?: { tx?: PrismaTransaction }): Promise<ICashClose> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.cashClose.create({ data });
  }

  async fetchCloses(scope: ILedgerScope, options?: IPaginationOptions): Promise<PaginatedResponse<ICashClose>> {
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"closedAt">(options ?? {});
    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : this.prisma.cashClose.findMany({ where: scope, ...paginationQuery, orderBy: orderBy ?? { closedAt: "desc" } }),
      options?.returnCount === false ? Promise.resolve(-1) : this.prisma.cashClose.count({ where: scope }),
    ]);
    return { rows, count };
  }

  async createExpense(data: IExpenseCreate, options?: { tx?: PrismaTransaction }): Promise<IExpense> {
    return (options?.tx ?? this.prisma).expense.create({ data });
  }

  async fetchExpenses(scope: ILedgerScope, since: Date | null, options?: IPaginationOptions): Promise<PaginatedResponse<IExpense>> {
    const { orderBy, ...paginationQuery } = buildPaginationQuery<"createdAt">(options ?? {});
    const where: Prisma.ExpenseWhereInput = { ...scope, ...(since && { createdAt: { gt: since } }) };
    const [rows, count] = await Promise.all([
      options?.returnData === false
        ? Promise.resolve([])
        : this.prisma.expense.findMany({ where, ...paginationQuery, orderBy: orderBy ?? { createdAt: "desc" } }),
      options?.returnCount === false ? Promise.resolve(-1) : this.prisma.expense.count({ where }),
    ]);
    return { rows, count };
  }

  async findExpense(id: string): Promise<IExpense | null> {
    return this.prisma.expense.findUnique({ where: { id } });
  }

  async deleteExpense(id: string): Promise<void> {
    await this.prisma.expense.delete({ where: { id } });
  }
}

export default LedgerRepositoryImpl;
