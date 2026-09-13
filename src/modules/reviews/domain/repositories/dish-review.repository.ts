import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IDishReview } from "../interfaces/dish-review.interface";

export interface IDishReviewCreate {
  restaurantId: string;
  dishId: string;
  orderId: string;
  sessionId: string;
  overall: number;
  taste: number;
  portion: number;
  value: number;
  wouldOrderAgain: boolean;
  comment?: string;
  tagIds?: string[];
}

export interface DishReviewFetchOptions {
  tx?: PrismaTransaction;
}

export interface IDishReviewsFetchQuery {
  restaurantId?: string;
  dishId?: string;
  sessionId?: string;
  minRating?: number;
  maxRating?: number;
  onlyWithComment?: boolean;
  isHidden?: boolean;
}

export interface IDishReviewsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class DishReviewRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: DishReviewFetchOptions): Promise<IDishReview | null>;
  abstract findByOrderAndDish(orderId: string, dishId: string, options?: DishReviewFetchOptions): Promise<IDishReview | null>;
  abstract create(data: IDishReviewCreate, options?: { tx?: PrismaTransaction }): Promise<IDishReview>;
  abstract fetchAll(query: IDishReviewsFetchQuery, options?: IDishReviewsFetchOptions): Promise<PaginatedResponse<IDishReview>>;
}
