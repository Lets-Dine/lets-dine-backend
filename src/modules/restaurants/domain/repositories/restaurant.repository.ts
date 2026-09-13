import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IRestaurant } from "../interfaces/restaurant.interface";

export interface IRestaurantCreate {
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  coverImageUrl?: string | null;
  currency?: string;
  timezone?: string;
  serviceChargeRate?: number;
  taxRate?: number;
}

export type IRestaurantUpdate = Partial<Omit<IRestaurantCreate, "slug">> & { isActive?: boolean };

export interface RestaurantFetchOptions {
  tx?: PrismaTransaction;
}

export interface IRestaurantsFetchQuery {
  keyword?: string;
  isActive?: boolean;
}

export interface IRestaurantsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class RestaurantRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: RestaurantFetchOptions): Promise<IRestaurant | null>;
  abstract findBySlug(slug: string, options?: RestaurantFetchOptions): Promise<IRestaurant | null>;
  abstract create(data: IRestaurantCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IRestaurant>;
  abstract update(id: string, data: IRestaurantUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IRestaurant>;
  abstract fetchAll(query: IRestaurantsFetchQuery, options?: IRestaurantsFetchOptions): Promise<PaginatedResponse<IRestaurant>>;
}
