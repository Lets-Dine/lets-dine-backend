import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IFloor } from "../interfaces/floor.interface";

export interface IFloorCreate {
  restaurantId: string;
  name: string;
  qrToken: string;
  sortOrder?: number;
}

export type IFloorUpdate = Partial<Pick<IFloor, "name" | "isActive" | "sortOrder" | "qrToken">>;

export interface FloorFetchOptions {
  tx?: PrismaTransaction;
}

export interface IFloorsFetchQuery {
  restaurantId: string;
  keyword?: string;
  isActive?: boolean;
}

export interface IFloorsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class FloorRepository {
  abstract findById(id: string, options?: FloorFetchOptions): Promise<IFloor | null>;
  abstract findByQrToken(qrToken: string, options?: FloorFetchOptions): Promise<IFloor | null>;
  abstract findByName(restaurantId: string, name: string, options?: FloorFetchOptions): Promise<IFloor | null>;
  abstract create(data: IFloorCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IFloor>;
  abstract update(id: string, data: IFloorUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IFloor>;
  abstract fetchAll(query: IFloorsFetchQuery, options?: IFloorsFetchOptions): Promise<PaginatedResponse<IFloor>>;
}
