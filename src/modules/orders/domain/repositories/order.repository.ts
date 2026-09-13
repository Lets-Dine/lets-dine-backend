import { OrderStatus } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IOrderWithItems } from "../interfaces/order.interface";

export interface IOrderItemCreate {
  dishId: string;
  dishNameSnapshot: string;
  imageUrlSnapshot?: string | null;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface IOrderCreate {
  restaurantId: string;
  tableId: string;
  sessionId: string;
  currency: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
  idempotencyKey?: string | null;
  items: IOrderItemCreate[];
}

export interface IOrderUpdate {
  status?: OrderStatus;
  cancelReason?: string | null;
  completedAt?: Date | null;
}

export interface OrderFetchOptions {
  tx?: PrismaTransaction;
}

export interface IOrdersFetchQuery {
  restaurantId?: string;
  sessionId?: string;
  tableId?: string;
  statuses?: OrderStatus[];
  from?: Date;
  to?: Date;
}

export interface IOrdersFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class OrderRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null>;
  abstract findByIdempotencyKey(key: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null>;
  /** §19 — the next ticket number for this restaurant (#1001, #1002 …). */
  abstract nextReference(restaurantId: string, options?: OrderFetchOptions): Promise<string>;
  abstract create(data: IOrderCreate, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems>;
  abstract update(id: string, data: IOrderUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IOrderWithItems>;
  abstract fetchAll(query: IOrdersFetchQuery, options?: IOrdersFetchOptions): Promise<PaginatedResponse<IOrderWithItems>>;
}
