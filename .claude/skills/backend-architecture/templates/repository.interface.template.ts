// domain/repositories/{feature-name}.repository.ts
import { PrismaClient } from "@holista/db";
import { AuthEntity, I{Feature}, IPaginationOptions, PaginatedResponse } from "@holista/core/interfaces";

export type I{Feature}Create = Omit<I{Feature}, "id" | "createdAt" | "updatedAt">;
export type I{Feature}Update = Partial<Omit<I{Feature}, "id" | "createdAt">>;

export interface {Feature}FetchOptions {
  tx?: PrismaClient;
  include?: {
    // related?: boolean;
  };
}

export interface I{Feature}sFetchQuery {
  keyword?: string;
  isActive?: boolean;
}

// Extending IPaginationOptions pulls in offset/limit/sortBy/sortOrder/returnData/returnCount —
// the same shared shape produced by spreading `paginationSchema` in the validation layer.
export interface I{Feature}sFetchOptions extends IPaginationOptions {
  tx?: PrismaClient;
}

export abstract class {Feature}Repository {
  abstract $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
  abstract findById(id: number, options?: {Feature}FetchOptions): Promise<I{Feature} | null>;
  abstract create(data: I{Feature}Create, options: { tx?: PrismaClient; authEntity: AuthEntity }): Promise<I{Feature}>;
  abstract update(id: number, data: I{Feature}Update, transaction?: PrismaClient): Promise<I{Feature}>;
  abstract delete(id: number, transaction?: PrismaClient): Promise<void>;
  abstract fetchAll(query: I{Feature}sFetchQuery, options?: I{Feature}sFetchOptions): Promise<PaginatedResponse<I{Feature}>>;
}
