import { ExpenseKind, PaymentMethod, StockMovementReason } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IPurchase, IIngredientSummary, IUsagePage, IIngredient, IRecipeLine } from "../interfaces/inventory.interface";
import { IUsage } from "../utils/forecast.util";
import { IRecipeCostLine, IUnitCost } from "../utils/margin.util";
import { ILotAllocation, IOpenLot } from "../utils/lot.util";
import { IRecipeLineRule } from "../utils/recipe.util";

export interface IIngredientCreate {
  restaurantId: string;
  branchId: string;
  name: string;
  unit: string;
  quantity: number;
  parLevel: number;
}

export interface IMovementCreate {
  reason: StockMovementReason;
  supplier?: string;
  cost?: number;
  orderItemId?: string;
  dishId?: string;
  note?: string;
  createdBy?: string;
  /** Defaults to now; a late-entered delivery carries the day it really arrived. */
  createdAt?: Date;
}

export interface IStockExpenseCreate {
  restaurantId: string;
  branchId: string;
  kind: ExpenseKind;
  amount: number;
  method: PaymentMethod;
  category: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Date;
}

export interface ILotCreate {
  ingredientId: string;
  /** Defaults to now. A transferred lot keeps its original date, so it stays in the same place in line. */
  receivedAt?: Date;
  supplier?: string;
  cost?: number;
  quantity: number;
  createdBy?: string;
}

/** A lot with something left, with enough of its history to carry it to another branch. */
export interface IOpenLotDetail extends IOpenLot {
  supplier: string | null;
  cost: number | null;
  quantity: number;
  receivedAt: Date;
}

/** One lot's share of one order line, with the ids a review is reached through. */
export interface ILotUse {
  lotId: string;
  ingredientId: string;
  ingredientName: string;
  supplier: string | null;
  receivedAt: Date;
  orderId: string;
  dishId: string;
}

export interface IReviewScores {
  orderId: string;
  dishId: string;
  taste: number;
  overall: number;
}

/** Where an ingredient was last bought, and what it cost per base unit. */
export interface ILastPurchase {
  ingredientId: string;
  supplier: string;
  /** Minor units for the whole lot, and how much the lot held — cost per unit is cost / quantity. */
  cost: number | null;
  quantity: number;
}

/** A dish with its recipe, for costing. Add-on lines are left out: an add-on is priced by the diner. */
export interface IDishRecipe {
  id: string;
  name: string;
  price: number;
  variants: { id: string; name: string; price: number }[];
  baseLines: IRecipeCostLine[];
  variantLines: (IRecipeCostLine & { variantId: string })[];
}

/** A dish whose base recipe uses a changed ingredient, with the live stock of everything in that recipe. */
export interface IDishStock {
  id: string;
  isAvailable: boolean;
  autoSoldOut: boolean;
  baseLines: { quantity: number; ingredient: { quantity: number } }[];
}

export abstract class InventoryRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findIngredients(branchId: string): Promise<IIngredient[]>;
  abstract findIngredient(id: string, options?: { tx?: PrismaTransaction }): Promise<IIngredient | null>;
  abstract findIngredientsByIds(ids: string[], branchId: string): Promise<IIngredient[]>;
  abstract createIngredient(data: IIngredientCreate, options?: { tx?: PrismaTransaction }): Promise<IIngredient>;
  abstract updateIngredient(
    id: string,
    data: Partial<Pick<IIngredient, "name" | "unit" | "parLevel" | "isArchived">>,
    options?: { tx?: PrismaTransaction }
  ): Promise<IIngredient>;
  /** Archived ones included — a transfer revives an ingredient rather than clashing with its name. */
  abstract findIngredientByName(branchId: string, name: string, tx: PrismaTransaction): Promise<IIngredient | null>;
  abstract findBranch(id: string): Promise<{ id: string; restaurantId: string; name: string; isActive: boolean } | null>;
  abstract findOpenLotDetails(ingredientId: string, tx: PrismaTransaction): Promise<IOpenLotDetail[]>;
  /** Moves the running quantity by `delta` and writes the movement that explains it, atomically with the caller's tx. */
  abstract applyMovement(ingredientId: string, delta: number, data: IMovementCreate, tx: PrismaTransaction): Promise<IIngredient>;
  abstract createStockExpense(data: IStockExpenseCreate, tx: PrismaTransaction): Promise<void>;
  abstract createLot(data: ILotCreate, tx: PrismaTransaction): Promise<void>;
  /** Lots with something left, oldest first. */
  abstract findOpenLots(ingredientId: string, tx: PrismaTransaction): Promise<IOpenLot[]>;
  /** Takes from each lot's `remaining`; with an `orderItemId`, also records which order line used it. */
  /** Empties every lot of an ingredient: used when a removed ingredient comes back, so old batches don't haunt the new stock. */
  abstract closeOpenLots(ingredientId: string, tx: PrismaTransaction): Promise<void>;
  abstract clearRecipeLines(ingredientId: string, tx: PrismaTransaction): Promise<void>;
  abstract applyLotUse(allocations: ILotAllocation[], orderItemId: string | undefined, tx: PrismaTransaction): Promise<void>;
  abstract findLotUses(branchId: string, since: Date): Promise<ILotUse[]>;
  abstract findReviewScores(restaurantId: string, orderIds: string[], dishIds: string[]): Promise<IReviewScores[]>;
  /** Ingredient use (order deductions) since `since`, per ingredient. */
  abstract findUsage(branchId: string, since: Date): Promise<Map<string, IUsage[]>>;
  abstract findIngredientSummary(ingredientId: string, since: Date): Promise<Omit<IIngredientSummary, "days">>;
  /** Deliveries of one ingredient, newest first. */
  abstract findPurchases(ingredientId: string, limit: number): Promise<IPurchase[]>;
  /** Order deductions of one ingredient, newest first, with the dish each was for. */
  abstract findIngredientUsage(ingredientId: string, page: number, pageSize: number): Promise<IUsagePage>;
  abstract findDishNames(ids: string[]): Promise<Map<string, string>>;
  abstract findLastPurchases(branchId: string): Promise<Map<string, ILastPurchase>>;
  abstract findBranchTimezone(branchId: string): Promise<string>;
  abstract findUnitCosts(branchId: string): Promise<Map<string, IUnitCost>>;
  abstract findDishRecipes(branchId: string): Promise<IDishRecipe[]>;
  abstract findDishInBranch(dishId: string, branchId: string): Promise<{ id: string } | null>;
  abstract findRecipeLines(dishId: string, options?: { tx?: PrismaTransaction }): Promise<IRecipeLine[]>;
  /** The auto-consume switch at each level above this dish, for `resolveAutoConsume`. */
  abstract findAutoConsumeSettings(
    dishId: string,
    tx: PrismaTransaction
  ): Promise<{ restaurantId: string; dish: boolean | null; branch: boolean | null; restaurant: boolean } | null>;
  abstract findRecipeRules(dishId: string, tx: PrismaTransaction): Promise<IRecipeLineRule[]>;
  abstract replaceRecipe(dishId: string, lines: IRecipeLineRule[]): Promise<IRecipeLine[]>;
  abstract findDishesUsingBase(branchId: string, ingredientIds: string[], tx: PrismaTransaction): Promise<IDishStock[]>;
  abstract setDishAvailability(dishId: string, data: { isAvailable: boolean; autoSoldOut: boolean }, tx: PrismaTransaction): Promise<void>;
}
