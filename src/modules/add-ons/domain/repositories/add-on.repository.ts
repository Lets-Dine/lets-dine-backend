import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IAddOn } from "../interfaces/add-on.interface";

export interface IAddOnCreate {
  restaurantId: string;
  name: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

export type IAddOnUpdate = Partial<Omit<IAddOnCreate, "restaurantId">> & { isArchived?: boolean };

export interface AddOnFetchOptions {
  tx?: PrismaTransaction;
}

export interface IAddOnsFetchQuery {
  restaurantId?: string;
  keyword?: string;
  isAvailable?: boolean;
  isArchived?: boolean;
  ids?: string[];
}

export interface IAddOnsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class AddOnRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: AddOnFetchOptions): Promise<IAddOn | null>;
  abstract findManyByIds(ids: string[], options?: AddOnFetchOptions): Promise<IAddOn[]>;
  abstract create(data: IAddOnCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IAddOn>;
  abstract update(id: string, data: IAddOnUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IAddOn>;
  abstract fetchAll(query: IAddOnsFetchQuery, options?: IAddOnsFetchOptions): Promise<PaginatedResponse<IAddOn>>;
  /** Every add-on currently linked to a dish, restaurant scoping inherited from the dish itself. */
  abstract findLinkedToDish(dishId: string, options?: AddOnFetchOptions): Promise<IAddOn[]>;
  /** Linked add-on ids for many dishes in one query, keyed by dish id — for menu/list reads. */
  abstract findLinkedIdsByDishIds(dishIds: string[], options?: AddOnFetchOptions): Promise<Record<string, string[]>>;
  /** Full-replace: the dish's linked add-ons become exactly `addOnIds`. */
  abstract setDishLinks(dishId: string, addOnIds: string[], options?: { tx?: PrismaTransaction }): Promise<void>;
}
