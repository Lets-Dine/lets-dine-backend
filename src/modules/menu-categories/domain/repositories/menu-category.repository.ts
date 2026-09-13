import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IMenuCategory } from "../interfaces/menu-category.interface";

export interface IMenuCategoryCreate {
  restaurantId: string;
  name: string;
  emoji?: string;
  sortOrder?: number;
}

export type IMenuCategoryUpdate = Partial<Pick<IMenuCategory, "name" | "emoji" | "sortOrder">>;

export interface MenuCategoryFetchOptions {
  tx?: PrismaTransaction;
}

export interface IMenuCategoriesFetchQuery {
  restaurantId: string;
  keyword?: string;
}

export interface IMenuCategoriesFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class MenuCategoryRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: MenuCategoryFetchOptions): Promise<IMenuCategory | null>;
  abstract findByName(restaurantId: string, name: string, options?: MenuCategoryFetchOptions): Promise<IMenuCategory | null>;
  abstract create(data: IMenuCategoryCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IMenuCategory>;
  abstract update(id: string, data: IMenuCategoryUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IMenuCategory>;
  abstract delete(id: string, transaction?: PrismaTransaction): Promise<void>;
  /** §28 — a category may only be deleted once nothing points at it. */
  abstract countDishes(categoryId: string, options?: MenuCategoryFetchOptions): Promise<number>;
  abstract fetchAll(query: IMenuCategoriesFetchQuery, options?: IMenuCategoriesFetchOptions): Promise<PaginatedResponse<IMenuCategory>>;
}
