import { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IOrderItemAddOn, IOrderWithItems } from "../interfaces/order.interface";

export interface IOrderItemCreate {
  dishId: string;
  dishNameSnapshot: string;
  imageUrlSnapshot?: string | null;
  unitPrice: number;
  quantity: number;
  notes?: string;
  addOns?: IOrderItemAddOn[];
  variantId?: string | null;
  variantNameSnapshot?: string | null;
  variantPriceSnapshot?: number | null;
}

export interface IOrderCreate {
  restaurantId: string;
  branchId: string;
  tableId: string | null;
  sessionId: string;
  floorId?: string | null;
  orderType?: OrderType;
  customerId?: string | null;
  currency: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  deliveryFee?: number;
  total: number;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  deliveryCustomerName?: string | null;
  deliveryNote?: string | null;
  floorVisitorName?: string | null;
  idempotencyKey?: string | null;
  items: IOrderItemCreate[];
}

export interface IOrderTotalsUpdate {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export interface IOrderUpdate extends Partial<IOrderTotalsUpdate> {
  status?: OrderStatus;
  cancelReason?: string | null;
  acceptedAt?: Date | null;
  cancelledAt?: Date | null;
  paidAt?: Date | null;
  completedAt?: Date | null;
}

/**
 * A surgical alternative to rebuilding an order's whole item list: only the
 * rows that actually changed are touched, so an existing row's `status` (and
 * `id`) survive an add/remove that leaves it alone. A created line is always
 * born PENDING — `status` is not settable from here.
 */
export interface IOrderItemSyncChanges {
  create: IOrderItemCreate[];
  updateQuantity: { id: string; quantity: number }[];
  deleteIds: string[];
}

export interface OrderFetchOptions {
  tx?: PrismaTransaction;
}

export interface IOrdersFetchQuery {
  restaurantId?: string;
  branchId?: string;
  sessionId?: string;
  tableId?: string;
  orderType?: OrderType;
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
  /** §19 — the next ticket number for this branch (#1001, #1002 …). */
  abstract nextReference(branchId: string, options?: OrderFetchOptions): Promise<string>;
  abstract create(data: IOrderCreate, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems>;
  abstract update(id: string, data: IOrderUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IOrderWithItems>;
  abstract fetchAll(query: IOrdersFetchQuery, options?: IOrdersFetchOptions): Promise<PaginatedResponse<IOrderWithItems>>;
  /** §21 — every order a table placed during one visit, items and all, in a single round trip. */
  abstract findBySessionId(sessionId: string, restaurantId: string, branchId: string): Promise<IOrderWithItems[]>;
  /** The order a table's bill gets adjusted against — its most recent, whatever status it's in. */
  abstract findLatestByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems | null>;
  /** Every order this table still owes on, to close out together on settle. */
  abstract findOpenByTableId(tableId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems[]>;
  /** Every order this visit left open, to reconcile together when its session ends. */
  abstract findOpenBySessionId(sessionId: string, restaurantId: string, options?: OrderFetchOptions): Promise<IOrderWithItems[]>;
  /**
   * Applies only the item rows that actually changed (create/quantity-update/
   * delete) and stamps the totals recomputed from the resulting set — unlike
   * a wholesale replace, every untouched row (and its `status`) survives.
   */
  abstract syncItems(
    orderId: string,
    changes: IOrderItemSyncChanges,
    totals: IOrderTotalsUpdate,
    options?: { tx?: PrismaTransaction }
  ): Promise<IOrderWithItems>;
  /** One line's kitchen status — accept/item-advance/item-cancel all funnel through this. */
  abstract updateItemStatus(itemId: string, status: OrderItemStatus, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems>;
  /** Marks every currently-open order on this table COMPLETED in one motion — the till. */
  abstract settleOpenByTableId(tableId: string, restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<IOrderWithItems[]>;
  /**
   * Delivery hand-over: the driver takes every plated line at once, so every
   * item still READY moves to SERVED together — used by `SettleDeliveryOrderUsecase`.
   */
  abstract markReadyItemsServed(orderId: string, options?: { tx?: PrismaTransaction }): Promise<void>;
}
