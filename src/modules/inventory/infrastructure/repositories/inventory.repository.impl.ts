import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPurchase, IIngredientSummary, IUsagePage, IIngredient, IRecipeLine } from "../../domain/interfaces/inventory.interface";
import {
  IDishRecipe,
  IDishStock,
  IIngredientCreate,
  IOpenLotDetail,
  ILastPurchase,
  ILotCreate,
  ILotUse,
  IReviewScores,
  IMovementCreate,
  InventoryRepository,
  IStockExpenseCreate,
} from "../../domain/repositories/inventory.repository";
import { IUsage } from "../../domain/utils/forecast.util";
import { IUnitCost, unitCostOfLot } from "../../domain/utils/margin.util";
import { ILotAllocation, IOpenLot } from "../../domain/utils/lot.util";
import { IRecipeLineRule } from "../../domain/utils/recipe.util";

@Injectable()
class InventoryRepositoryImpl implements InventoryRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findIngredients(branchId: string): Promise<IIngredient[]> {
    return this.prisma.ingredient.findMany({ where: { branchId, isArchived: false }, orderBy: { name: "asc" } });
  }

  async findIngredient(id: string, options?: { tx?: PrismaTransaction }): Promise<IIngredient | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.ingredient.findUnique({ where: { id } });
  }

  async findIngredientsByIds(ids: string[], branchId: string): Promise<IIngredient[]> {
    return this.prisma.ingredient.findMany({ where: { id: { in: ids }, branchId, isArchived: false } });
  }

  async createIngredient(data: IIngredientCreate, options?: { tx?: PrismaTransaction }): Promise<IIngredient> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.ingredient.create({ data });
  }

  async updateIngredient(
    id: string,
    data: Partial<Pick<IIngredient, "name" | "unit" | "parLevel" | "isArchived">>,
    options?: { tx?: PrismaTransaction }
  ): Promise<IIngredient> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.ingredient.update({ where: { id }, data });
  }

  async findIngredientByName(branchId: string, name: string, tx: PrismaTransaction): Promise<IIngredient | null> {
    return tx.ingredient.findUnique({ where: { branchId_name: { branchId, name } } });
  }

  async findBranch(id: string): Promise<{ id: string; restaurantId: string; name: string; isActive: boolean } | null> {
    return this.prisma.branch.findUnique({ where: { id }, select: { id: true, restaurantId: true, name: true, isActive: true } });
  }

  async findOpenLotDetails(ingredientId: string, tx: PrismaTransaction): Promise<IOpenLotDetail[]> {
    return tx.stockLot.findMany({
      where: { ingredientId, remaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
      select: { id: true, remaining: true, supplier: true, cost: true, quantity: true, receivedAt: true },
    });
  }

  async applyMovement(ingredientId: string, delta: number, data: IMovementCreate, tx: PrismaTransaction): Promise<IIngredient> {
    await tx.stockMovement.create({ data: { ingredientId, delta, ...data } });
    return tx.ingredient.update({ where: { id: ingredientId }, data: { quantity: { increment: delta } } });
  }

  async createStockExpense(data: IStockExpenseCreate, tx: PrismaTransaction): Promise<void> {
    await tx.expense.create({ data });
  }

  async createLot(data: ILotCreate, tx: PrismaTransaction): Promise<void> {
    await tx.stockLot.create({ data: { ...data, remaining: data.quantity } });
  }

  async findOpenLots(ingredientId: string, tx: PrismaTransaction): Promise<IOpenLot[]> {
    return tx.stockLot.findMany({
      where: { ingredientId, remaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
      select: { id: true, remaining: true },
    });
  }

  async closeOpenLots(ingredientId: string, tx: PrismaTransaction): Promise<void> {
    await tx.stockLot.updateMany({ where: { ingredientId, remaining: { gt: 0 } }, data: { remaining: 0 } });
  }

  async clearRecipeLines(ingredientId: string, tx: PrismaTransaction): Promise<void> {
    await tx.recipeLine.deleteMany({ where: { ingredientId } });
  }

  async applyLotUse(allocations: ILotAllocation[], orderItemId: string | undefined, tx: PrismaTransaction): Promise<void> {
    for (const { lotId, quantity } of allocations) {
      await tx.stockLot.update({ where: { id: lotId }, data: { remaining: { decrement: quantity } } });
      if (orderItemId) await tx.lotConsumption.create({ data: { lotId, orderItemId, quantity } });
    }
  }

  async findLotUses(branchId: string, since: Date): Promise<ILotUse[]> {
    const rows = await this.prisma.lotConsumption.findMany({
      where: { createdAt: { gte: since }, lot: { ingredient: { branchId } } },
      select: {
        lotId: true,
        lot: { select: { supplier: true, receivedAt: true, ingredient: { select: { id: true, name: true } } } },
        orderItemId: true,
      },
    });
    const items = await this.prisma.orderItem.findMany({
      where: { id: { in: [...new Set(rows.map(r => r.orderItemId))] } },
      select: { id: true, orderId: true, dishId: true },
    });
    const itemById = new Map(items.map(item => [item.id, item]));
    return rows.flatMap(row => {
      const item = itemById.get(row.orderItemId);
      if (!item) return [];
      return [
        {
          lotId: row.lotId,
          ingredientId: row.lot.ingredient.id,
          ingredientName: row.lot.ingredient.name,
          supplier: row.lot.supplier,
          receivedAt: row.lot.receivedAt,
          orderId: item.orderId,
          dishId: item.dishId,
        },
      ];
    });
  }

  async findReviewScores(restaurantId: string, orderIds: string[], dishIds: string[]): Promise<IReviewScores[]> {
    if (orderIds.length === 0) return [];
    return this.prisma.dishReview.findMany({
      where: { restaurantId, isHidden: false, orderId: { in: orderIds }, dishId: { in: dishIds } },
      select: { orderId: true, dishId: true, taste: true, overall: true },
    });
  }

  async findUsage(branchId: string, since: Date): Promise<Map<string, IUsage[]>> {
    const rows = await this.prisma.stockMovement.findMany({
      // Manual use counts as demand only when it was for a dish; waste and staff meals are not.
      where: {
        OR: [{ reason: "ORDER" }, { reason: "MANUAL_USE", dishId: { not: null } }],
        createdAt: { gte: since },
        ingredient: { branchId, isArchived: false },
      },
      select: { ingredientId: true, delta: true, createdAt: true },
    });
    const byIngredient = new Map<string, IUsage[]>();
    for (const row of rows) {
      const list = byIngredient.get(row.ingredientId) ?? [];
      list.push({ at: row.createdAt, quantity: -row.delta });
      byIngredient.set(row.ingredientId, list);
    }
    return byIngredient;
  }

  async findIngredientSummary(ingredientId: string, since: Date): Promise<Omit<IIngredientSummary, "days">> {
    const recent = { ingredientId, createdAt: { gte: since } };
    const [moreIn, lessOut, last, lot] = await Promise.all([
      this.prisma.stockMovement.aggregate({ where: { ...recent, delta: { gt: 0 } }, _sum: { delta: true } }),
      this.prisma.stockMovement.aggregate({ where: { ...recent, delta: { lt: 0 } }, _sum: { delta: true } }),
      this.prisma.stockMovement.findFirst({
        where: { ingredientId },
        orderBy: { createdAt: "desc" },
        select: { reason: true, delta: true, note: true, createdAt: true },
      }),
      this.prisma.stockLot.findFirst({
        where: { ingredientId, OR: [{ supplier: { not: null } }, { cost: { not: null } }] },
        orderBy: { receivedAt: "desc" },
        select: { supplier: true, cost: true, quantity: true, receivedAt: true },
      }),
    ]);
    return {
      stockIn: moreIn._sum.delta ?? 0,
      stockOut: -(lessOut._sum.delta ?? 0),
      lastMovement: last ? { reason: last.reason, delta: last.delta, note: last.note, at: last.createdAt } : null,
      lastPurchase: lot ? { supplier: lot.supplier, cost: lot.cost, quantity: lot.quantity, at: lot.receivedAt } : null,
    };
  }

  async findPurchases(ingredientId: string, limit: number): Promise<IPurchase[]> {
    const rows = await this.prisma.stockMovement.findMany({
      where: { ingredientId, reason: "DELIVERY" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, createdAt: true, supplier: true, delta: true, cost: true },
    });
    return rows.map(r => ({ id: r.id, at: r.createdAt, supplier: r.supplier, quantity: r.delta, cost: r.cost }));
  }

  async findIngredientUsage(ingredientId: string, page: number, pageSize: number): Promise<IUsagePage> {
    const where = {
      ingredientId,
      OR: [{ reason: "ORDER" as const, orderItemId: { not: null } }, { reason: "MANUAL_USE" as const }],
    };
    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, delta: true, createdAt: true, reason: true, orderItemId: true, dishId: true, note: true },
      }),
    ]);
    const [orderItems, dishNames] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { id: { in: movements.flatMap(m => (m.orderItemId ? [m.orderItemId] : [])) } },
        select: { id: true, dishNameSnapshot: true, quantity: true },
      }),
      this.findDishNames(movements.flatMap(m => (m.dishId ? [m.dishId] : []))),
    ]);
    const itemById = new Map(orderItems.map(item => [item.id, item]));
    return {
      total,
      page,
      pageSize,
      items: movements.map(m => {
        if (m.reason === "MANUAL_USE") {
          return {
            id: m.id,
            at: m.createdAt,
            dishName: m.dishId ? (dishNames.get(m.dishId) ?? "Removed dish") : null,
            source: "manual" as const,
            note: m.note,
            portions: null,
            quantity: -m.delta,
          };
        }
        const item = m.orderItemId ? itemById.get(m.orderItemId) : undefined;
        return {
          id: m.id,
          at: m.createdAt,
          dishName: item?.dishNameSnapshot ?? "Removed dish",
          source: "order" as const,
          note: "",
          portions: item?.quantity ?? 0,
          quantity: -m.delta,
        };
      }),
    };
  }

  async findDishNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const dishes = await this.prisma.dish.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
    return new Map(dishes.map(dish => [dish.id, dish.name]));
  }

  async findLastPurchases(branchId: string): Promise<Map<string, ILastPurchase>> {
    const lots = await this.prisma.stockLot.findMany({
      where: { supplier: { not: null }, ingredient: { branchId } },
      orderBy: { receivedAt: "desc" },
      distinct: ["ingredientId"],
      select: { ingredientId: true, supplier: true, cost: true, quantity: true },
    });
    return new Map(lots.map(lot => [lot.ingredientId, { ...lot, supplier: lot.supplier as string }]));
  }

  async findBranchTimezone(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
    return branch?.timezone ?? "Asia/Kathmandu";
  }

  async findUnitCosts(branchId: string): Promise<Map<string, IUnitCost>> {
    // ponytail: reads every priced lot to keep the newest two per ingredient; fine until lots pile up, then window it.
    const lots = await this.prisma.stockLot.findMany({
      where: { cost: { not: null }, quantity: { gt: 0 }, ingredient: { branchId } },
      orderBy: { receivedAt: "desc" },
      select: { ingredientId: true, cost: true, quantity: true },
    });
    const costs = new Map<string, IUnitCost>();
    for (const lot of lots) {
      const unit = unitCostOfLot(lot.cost as number, lot.quantity);
      const seen = costs.get(lot.ingredientId);
      if (!seen) costs.set(lot.ingredientId, { unit, previous: null });
      else if (seen.previous === null) seen.previous = unit;
    }
    return costs;
  }

  async findDishRecipes(branchId: string): Promise<IDishRecipe[]> {
    const dishes = await this.prisma.dish.findMany({
      where: { branchId, isArchived: false, recipeLines: { some: {} } },
      select: {
        id: true,
        name: true,
        price: true,
        variants: { where: { isArchived: false }, select: { id: true, name: true, price: true } },
        recipeLines: {
          select: { ingredientId: true, variantId: true, addOnId: true, quantity: true, ingredient: { select: { name: true } } },
        },
      },
    });
    return dishes.map(dish => {
      const line = (l: (typeof dish.recipeLines)[number]) => ({
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        quantity: l.quantity,
      });
      return {
        id: dish.id,
        name: dish.name,
        price: dish.price,
        variants: dish.variants,
        baseLines: dish.recipeLines.filter(l => !l.variantId && !l.addOnId).map(line),
        variantLines: dish.recipeLines.filter(l => l.variantId).map(l => ({ ...line(l), variantId: l.variantId as string })),
      };
    });
  }

  async findDishInBranch(dishId: string, branchId: string): Promise<{ id: string } | null> {
    return this.prisma.dish.findFirst({ where: { id: dishId, branchId }, select: { id: true } });
  }

  async findRecipeLines(dishId: string, options?: { tx?: PrismaTransaction }): Promise<IRecipeLine[]> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.recipeLine.findMany({ where: { dishId } });
  }

  async findAutoConsumeSettings(
    dishId: string,
    tx: PrismaTransaction
  ): Promise<{ restaurantId: string; dish: boolean | null; branch: boolean | null; restaurant: boolean } | null> {
    const dish = await tx.dish.findUnique({
      where: { id: dishId },
      select: {
        restaurantId: true,
        autoConsumeStock: true,
        branch: { select: { autoConsumeStock: true } },
        restaurant: { select: { autoConsumeStock: true } },
      },
    });
    return (
      dish && {
        restaurantId: dish.restaurantId,
        dish: dish.autoConsumeStock,
        branch: dish.branch.autoConsumeStock,
        restaurant: dish.restaurant.autoConsumeStock,
      }
    );
  }

  async findRecipeRules(dishId: string, tx: PrismaTransaction): Promise<IRecipeLineRule[]> {
    return tx.recipeLine.findMany({ where: { dishId }, select: { ingredientId: true, variantId: true, addOnId: true, quantity: true } });
  }

  async replaceRecipe(dishId: string, lines: IRecipeLineRule[]): Promise<IRecipeLine[]> {
    await this.prisma.$transaction([
      this.prisma.recipeLine.deleteMany({ where: { dishId } }),
      this.prisma.recipeLine.createMany({ data: lines.map(line => ({ ...line, dishId })) }),
    ]);
    return this.findRecipeLines(dishId);
  }

  async findDishesUsingBase(branchId: string, ingredientIds: string[], tx: PrismaTransaction): Promise<IDishStock[]> {
    const dishes = await tx.dish.findMany({
      where: {
        branchId,
        isArchived: false,
        recipeLines: { some: { ingredientId: { in: ingredientIds }, variantId: null, addOnId: null } },
      },
      select: {
        id: true,
        isAvailable: true,
        autoSoldOut: true,
        recipeLines: {
          where: { variantId: null, addOnId: null },
          select: { quantity: true, ingredient: { select: { quantity: true } } },
        },
      },
    });
    return dishes.map(({ recipeLines, ...dish }) => ({ ...dish, baseLines: recipeLines }));
  }

  async setDishAvailability(dishId: string, data: { isAvailable: boolean; autoSoldOut: boolean }, tx: PrismaTransaction): Promise<void> {
    await tx.dish.update({ where: { id: dishId }, data });
  }
}

export default InventoryRepositoryImpl;
