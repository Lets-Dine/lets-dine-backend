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

export interface IOrderTotalsUpdate {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
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
  /** §21 — every order a table placed during one visit, items and all, in a single round trip. */
  abstract findBySessionId(sessionId: string, restaurantId: string): Promise<IOrderWithItems[]>;
  /** The order a table's bill gets adjusted against — its most recent, whatever status it's in. */
  abstract findLatestByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null>;
  /** Every order this table still owes on, to close out together on settle. */
  abstract findOpenByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems[]>;
  /** Replaces an order's lines wholesale and stamps the totals recomputed from them. */
  abstract replaceItems(
    orderId: string,
    items: IOrderItemCreate[],
    totals: IOrderTotalsUpdate,
    options?: { tx?: PrismaTransaction }
  ): Promise<IOrderWithItems>;
  /** Marks every currently-open order on this table COMPLETED in one motion — the till. */
  abstract settleOpenByTableId(tableId: string, restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems[]>;
  /** Marks every currently-open order on this session COMPLETED in one motion — what ending a visit does to whatever it leaves behind. */
  abstract settleOpenBySessionId(sessionId: string, restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<number>;
}
