import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IDiningTable } from "../interfaces/dining-table.interface";

export interface IDiningTableCreate {
  restaurantId: string;
  name: string;
  qrToken: string;
  capacity?: number;
  sortOrder?: number;
}

export type IDiningTableUpdate = Partial<Pick<IDiningTable, "name" | "capacity" | "isActive" | "sortOrder" | "qrToken">>;

export interface DiningTableFetchOptions {
  tx?: PrismaTransaction;
}

export interface IDiningTablesFetchQuery {
  restaurantId: string;
  keyword?: string;
  isActive?: boolean;
}

export interface IDiningTablesFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class DiningTableRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null>;
  abstract findByQrToken(qrToken: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null>;
  abstract findByName(restaurantId: string, name: string, options?: DiningTableFetchOptions): Promise<IDiningTable | null>;
  abstract create(data: IDiningTableCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDiningTable>;
  abstract update(id: string, data: IDiningTableUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IDiningTable>;
  abstract fetchAll(query: IDiningTablesFetchQuery, options?: IDiningTablesFetchOptions): Promise<PaginatedResponse<IDiningTable>>;
}
