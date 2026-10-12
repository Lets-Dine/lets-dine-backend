import { Injectable } from "@nestjs/common";
import { ExpenseKind, SupplierIssueKind } from "@prisma/client";
import { PrismaService } from "../../../../common/prisma";
import { IDelivery, IIssue, IReturn, INamedStats, IPayment, ISupplierRecord } from "../../domain/interfaces/suppliers.interface";
import { IOtherPrice } from "../../domain/utils/supplier-prices.util";
import { IPaymentCreate, SuppliersRepository } from "../../domain/repositories/suppliers.repository";

const SELECT = { id: true, name: true, phone: true, note: true, isArchived: true };
/** Case-insensitive equality. Prisma compiles this to ILIKE, so `%`, `_` and `\` in a name are escaped to match literally. */
const same = (supplier: string) => ({ equals: supplier.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const });

@Injectable()
class SuppliersRepositoryImpl implements SuppliersRepository {
  constructor(private prisma: PrismaService) {}

  async findSuppliers(restaurantId: string): Promise<ISupplierRecord[]> {
    return this.prisma.supplier.findMany({ where: { restaurantId }, orderBy: { name: "asc" }, select: SELECT });
  }

  async findSupplier(id: string, restaurantId: string): Promise<ISupplierRecord | null> {
    return this.prisma.supplier.findFirst({ where: { id, restaurantId }, select: SELECT });
  }

  async findSupplierByName(restaurantId: string, name: string): Promise<ISupplierRecord | null> {
    return this.prisma.supplier.findFirst({ where: { restaurantId, name: same(name) }, select: SELECT });
  }

  async createSupplier(data: { restaurantId: string; name: string; phone: string; note: string; createdBy: string }): Promise<ISupplierRecord> {
    return this.prisma.supplier.create({ data, select: SELECT });
  }

  async updateSupplier(id: string, data: Partial<Pick<ISupplierRecord, "phone" | "note" | "isArchived">>): Promise<ISupplierRecord> {
    return this.prisma.supplier.update({ where: { id }, data, select: SELECT });
  }

  async findDeliveryStats(branchId: string): Promise<Map<string, INamedStats>> {
    const groups = await this.prisma.stockLot.groupBy({
      by: ["supplier", "onCredit"],
      where: { supplier: { not: null }, fromTransfer: false, ingredient: { branchId } },
      _count: { _all: true },
      _sum: { cost: true },
      _max: { receivedAt: true },
    });
    // Spellings that differ only in case are one supplier; the busiest spelling is the one shown.
    const merged = new Map<string, INamedStats & { busiest: number }>();
    const spellings = new Map<string, number>();
    for (const g of groups) {
      const name = g.supplier as string;
      const key = name.toLowerCase();
      const cost = g._sum.cost ?? 0;
      const into = merged.get(key) ?? { name, busiest: 0, deliveries: 0, spent: 0, credit: 0, lastDeliveryAt: null };
      spellings.set(name, (spellings.get(name) ?? 0) + g._count._all);
      into.deliveries += g._count._all;
      into.spent += cost;
      if (g.onCredit) into.credit += cost;
      if ((spellings.get(name) ?? 0) > into.busiest) Object.assign(into, { name, busiest: spellings.get(name) ?? 0 });
      const last = g._max.receivedAt;
      if (last && (!into.lastDeliveryAt || last > into.lastDeliveryAt)) into.lastDeliveryAt = last;
      merged.set(key, into);
    }
    // What returns gave back comes off the totals (and off what is owed, for credit deliveries).
    const returned = await this.prisma.supplierReturn.groupBy({ by: ["supplier"], where: { branchId }, _sum: { amount: true, owedOffset: true } });
    for (const g of returned) {
      const into = merged.get(g.supplier.toLowerCase());
      if (!into) continue;
      into.spent = Math.max(0, into.spent - (g._sum.amount ?? 0));
      into.credit = Math.max(0, into.credit - (g._sum.owedOffset ?? 0));
    }
    return new Map([...merged].map(([key, { busiest: _busiest, ...stats }]) => [key, stats]));
  }

  async findPaidTotals(branchId: string): Promise<Map<string, number>> {
    const groups = await this.prisma.supplierPayment.groupBy({ by: ["supplier"], where: { branchId }, _sum: { amount: true } });
    const totals = new Map<string, number>();
    for (const g of groups) totals.set(g.supplier.toLowerCase(), (totals.get(g.supplier.toLowerCase()) ?? 0) + (g._sum.amount ?? 0));
    return totals;
  }

  async findDeliveries(branchId: string, supplier: string, limit: number, offset = 0): Promise<IDelivery[]> {
    const lots = await this.prisma.stockLot.findMany({
      where: { supplier: same(supplier), fromTransfer: false, ingredient: { branchId } },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit,
      select: { id: true, receivedAt: true, quantity: true, remaining: true, cost: true, onCredit: true, ingredient: { select: { id: true, name: true, unit: true } } },
    });
    const refunds = await this.prisma.supplierReturn.groupBy({ by: ["lotId"], where: { lotId: { in: lots.map(l => l.id) } }, _sum: { amount: true } });
    const refunded = new Map(refunds.map(r => [r.lotId, r._sum.amount ?? 0]));
    return lots.map(l => ({
      remaining: l.remaining,
      refunded: refunded.get(l.id) ?? 0,
      id: l.id,
      receivedAt: l.receivedAt,
      ingredientId: l.ingredient.id,
      ingredientName: l.ingredient.name,
      unit: l.ingredient.unit,
      quantity: l.quantity,
      cost: l.cost,
      onCredit: l.onCredit,
    }));
  }

  async findOtherPrices(branchId: string, ingredientIds: string[], excludeSupplier: string): Promise<IOtherPrice[]> {
    if (ingredientIds.length === 0) return [];
    // Newest first, so `distinct` keeps each supplier's latest priced lot per ingredient.
    const lots = await this.prisma.stockLot.findMany({
      where: { ingredientId: { in: ingredientIds }, supplier: { not: null }, cost: { gt: 0 }, quantity: { gt: 0 }, fromTransfer: false, ingredient: { branchId } },
      orderBy: { receivedAt: "desc" },
      distinct: ["ingredientId", "supplier"],
      select: { ingredientId: true, supplier: true, cost: true, quantity: true },
    });
    const skip = excludeSupplier.toLowerCase();
    // Spellings that differ only in case are one supplier, so keep the newest of each (first seen).
    const seen = new Set<string>();
    const out: IOtherPrice[] = [];
    for (const l of lots) {
      const supplier = l.supplier as string;
      const key = `${l.ingredientId}:${supplier.toLowerCase()}`;
      if (supplier.toLowerCase() === skip || seen.has(key)) continue;
      seen.add(key);
      out.push({ ingredientId: l.ingredientId, supplier, unitCost: (l.cost as number) / l.quantity });
    }
    return out;
  }

  async findReturns(branchId: string, supplier: string, limit: number): Promise<IReturn[]> {
    const rows = await this.prisma.supplierReturn.findMany({
      where: { branchId, supplier: same(supplier) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, ingredientId: true, quantity: true, amount: true, owedOffset: true, note: true, createdAt: true },
    });
    const ingredients = await this.prisma.ingredient.findMany({ where: { id: { in: rows.map(r => r.ingredientId) } }, select: { id: true, name: true, unit: true } });
    const byId = new Map(ingredients.map(i => [i.id, i]));
    return rows.map(r => ({
      id: r.id,
      ingredientName: byId.get(r.ingredientId)?.name ?? "Removed ingredient",
      unit: byId.get(r.ingredientId)?.unit ?? "pcs",
      quantity: r.quantity,
      amount: r.amount,
      owedOffset: r.owedOffset,
      note: r.note,
      createdAt: r.createdAt,
    }));
  }

  async findPayments(branchId: string, supplier: string, limit: number): Promise<IPayment[]> {
    return this.prisma.supplierPayment.findMany({
      where: { branchId, supplier: same(supplier) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, amount: true, method: true, note: true, createdAt: true },
    });
  }

  async createPayment(data: IPaymentCreate): Promise<IPayment> {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.supplierPayment.create({
        data: { restaurantId: data.restaurantId, branchId: data.branchId, supplier: data.supplier, amount: data.amount, method: data.method, note: data.note, createdBy: data.createdBy },
        select: { id: true, amount: true, method: true, note: true, createdAt: true },
      });
      // The money leaves now, so the cash book hears about it now (the delivery itself booked nothing).
      await tx.expense.create({
        data: {
          supplierPaymentId: payment.id,
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          kind: ExpenseKind.EXPENSE,
          amount: data.amount,
          method: data.method,
          category: "stock",
          note: [`Paid ${data.supplier}`, data.note].filter(Boolean).join(" — "),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
        },
      });
      return payment;
    });
  }

  async findIssues(restaurantId: string, supplier: string, limit: number): Promise<IIssue[]> {
    return this.prisma.supplierIssue.findMany({
      where: { restaurantId, supplier: same(supplier) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, kind: true, note: true, createdAt: true, createdByName: true },
    });
  }

  async countIssues(restaurantId: string, supplier: string): Promise<Partial<Record<SupplierIssueKind, number>>> {
    const groups = await this.prisma.supplierIssue.groupBy({ by: ["kind"], where: { restaurantId, supplier: same(supplier) }, _count: { _all: true } });
    return Object.fromEntries(groups.map(g => [g.kind, g._count._all]));
  }

  async createIssue(data: {
    restaurantId: string;
    supplier: string;
    kind: SupplierIssueKind;
    note: string;
    createdBy: string;
    createdByName: string;
  }): Promise<IIssue> {
    return this.prisma.supplierIssue.create({ data, select: { id: true, kind: true, note: true, createdAt: true, createdByName: true } });
  }
}

export default SuppliersRepositoryImpl;
