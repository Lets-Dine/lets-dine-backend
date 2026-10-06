import { Injectable } from "@nestjs/common";
import { ExpenseKind, PaymentMethod, Prisma } from "@prisma/client";
import { buildPaginationQuery } from "../../../../common/helpers";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { ICashClose, IExpense, IPeriodTotals, ISaleLine } from "../../domain/interfaces/ledger.interface";
import { ICashCloseCreate, IExpenseCreate, ILedgerScope, LedgerRepository } from "../../domain/repositories/ledger.repository";

/** Sum of `total`/`amount` per payment method from a groupBy result. */
function byMethod(
  rows: { method: PaymentMethod; kind?: ExpenseKind; _sum: { total?: number | null; amount?: number | null } }[],
  method: PaymentMethod,
  kind?: ExpenseKind
): number {
  const row = rows.find(r => r.method === method && (kind === undefined || r.kind === kind));
  return row?._sum.total ?? row?._sum.amount ?? 0;
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

    const [sales, expenses] = await Promise.all([
      prisma.payment.groupBy({ by: ["method"], where: { ...scope, createdAt }, _sum: { total: true } }),
      prisma.expense.groupBy({ by: ["method", "kind"], where: { ...scope, createdAt }, _sum: { amount: true } }),
    ]);

    return {
      cashSales: byMethod(sales, PaymentMethod.CASH),
      cardSales: byMethod(sales, PaymentMethod.CARD),
      cashExpenses: byMethod(expenses, PaymentMethod.CASH, ExpenseKind.EXPENSE),
      cardExpenses: byMethod(expenses, PaymentMethod.CARD, ExpenseKind.EXPENSE),
      cashIncome: byMethod(expenses, PaymentMethod.CASH, ExpenseKind.INCOME),
      cardIncome: byMethod(expenses, PaymentMethod.CARD, ExpenseKind.INCOME),
      deposits: byMethod(expenses, PaymentMethod.CASH, ExpenseKind.DEPOSIT),
      withdrawals: byMethod(expenses, PaymentMethod.CASH, ExpenseKind.WITHDRAWAL),
    };
  }

  async fetchSales(scope: ILedgerScope, since: Date | null): Promise<ISaleLine[]> {
    const rows = await this.prisma.payment.findMany({
      where: { ...scope, ...(since && { createdAt: { gt: since } }) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        total: true,
        method: true,
        table: { select: { name: true } },
        items: { select: { dishNameSnapshot: true, quantity: true } },
      },
    });
    return rows.map(({ table, ...sale }) => ({ ...sale, tableName: table?.name ?? null }));
  }

  async fetchAllExpenses(scope: ILedgerScope, since: Date | null): Promise<IExpense[]> {
    return this.prisma.expense.findMany({ where: { ...scope, ...(since && { createdAt: { gt: since } }) }, orderBy: { createdAt: "asc" } });
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

  async createExpense(data: IExpenseCreate): Promise<IExpense> {
    return this.prisma.expense.create({ data });
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
