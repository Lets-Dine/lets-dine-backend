import { DishDietaryType } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IDishVariant } from "../interfaces/dish-variant.interface";

export interface IDishVariantCreate {
  dishId: string;
  name: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
  spiceLevel?: number;
  dietaryType?: DishDietaryType;
}

export type IDishVariantUpdate = Partial<Omit<IDishVariantCreate, "dishId">> & { isArchived?: boolean };

export interface DishVariantFetchOptions {
  tx?: PrismaTransaction;
  isArchived?: boolean;
}

/**
 * Unlike AddOn, a variant has no cross-dish reuse case, so there's no bulk
 * "replace the set" method — rows aren't shared, so ordinary per-row
 * create/update/archive is correct (a bulk replace would blow away
 * OrderItem.variantId FK integrity on delete-then-recreate).
 */
export abstract class DishVariantRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: { tx?: PrismaTransaction }): Promise<IDishVariant | null>;
  abstract findByDishId(dishId: string, options?: DishVariantFetchOptions): Promise<IDishVariant[]>;
  /** Every dish's variants for many dishes in one query, keyed by dish id — for menu/list reads. */
  abstract findManyByDishIds(dishIds: string[], options?: DishVariantFetchOptions): Promise<Record<string, IDishVariant[]>>;
  abstract create(data: IDishVariantCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDishVariant>;
  abstract update(id: string, data: IDishVariantUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDishVariant>;
}
