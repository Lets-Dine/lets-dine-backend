import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IDish } from "../interfaces/dish.interface";
import { IDishWithStats } from "../interfaces/dish-with-stats.interface";

export interface IDishCreate {
  restaurantId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string | null;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  spiceLevel?: number;
  isVeg?: boolean;
}

export type IDishUpdate = Partial<Omit<IDishCreate, "restaurantId">> & { isArchived?: boolean };

export interface DishFetchOptions {
  tx?: PrismaTransaction;
}

export interface IDishesFetchQuery {
  restaurantId?: string;
  categoryId?: string;
  keyword?: string;
  isAvailable?: boolean;
  isArchived?: boolean;
  isFeatured?: boolean;
  ids?: string[];
}

export interface IDishesFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export interface IDishesWithStatsOptions {
  tx?: PrismaTransaction;
  /** Length of each ordering window, in days. Mirrors DishStatsRepository's §12 windows. */
  windowDays?: number;
}

export abstract class DishRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: DishFetchOptions): Promise<IDish | null>;
  abstract findBySlug(restaurantId: string, slug: string, options?: DishFetchOptions): Promise<IDish | null>;
  abstract findManyByIds(ids: string[], options?: DishFetchOptions): Promise<IDish[]>;
  abstract create(data: IDishCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish>;
  abstract update(id: string, data: IDishUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDish>;
  abstract fetchAll(query: IDishesFetchQuery, options?: IDishesFetchOptions): Promise<PaginatedResponse<IDish>>;
  /**
   * Every dish of a restaurant with its §12 stats and §49 badges in one round
   * trip — dish rows plus review/order aggregates joined in SQL instead of the
   * fetch-then-fan-out-per-stat pattern `fetchAll` + `DishStatsService.attach` uses.
   */
  abstract findAllWithStats(query: IDishesFetchQuery, options?: IDishesWithStatsOptions): Promise<IDishWithStats[]>;
}
