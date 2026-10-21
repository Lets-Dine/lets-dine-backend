import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IRecurringExpenseRow } from "../../domain/interfaces/recurring-expense.interface";
import { IRecurringExpenseCreate, IRecurringExpenseUpdate, RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";

@Injectable()
class RecurringExpenseRepositoryImpl implements RecurringExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findForBranch(restaurantId: string, branchId: string): Promise<IRecurringExpenseRow[]> {
    return this.prisma.recurringExpense.findMany({ where: { restaurantId, branchId }, orderBy: { createdAt: "asc" } });
  }

  findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IRecurringExpenseRow | null> {
    return (options?.tx ?? this.prisma).recurringExpense.findUnique({ where: { id } });
  }

  create(data: IRecurringExpenseCreate): Promise<IRecurringExpenseRow> {
    return this.prisma.recurringExpense.create({ data });
  }

  update(id: string, data: IRecurringExpenseUpdate): Promise<IRecurringExpenseRow> {
    return this.prisma.recurringExpense.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.recurringExpense.delete({ where: { id } });
  }

  async advance(id: string, from: Date | null, to: Date, tx: PrismaTransaction): Promise<boolean> {
    const moved = await tx.recurringExpense.updateMany({ where: { id, handledThrough: from }, data: { handledThrough: to } });
    return moved.count === 1;
  }
}

export default RecurringExpenseRepositoryImpl;
