import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IPaymentRefund, IPaymentTender, IPaymentWithItems } from "../interfaces/payment.interface";

export interface IPaymentItemCreate {
  dishId: string;
  dishNameSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface IPaymentCreate {
  restaurantId: string;
  branchId: string;
  sessionId: string;
  tableId: string | null;
  floorId?: string | null;
  customerId?: string | null;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  /** The part of `discount` that redeemed points paid for. */
  loyaltyDiscount?: number;
  total: number;
  /** What the first tenders already cover; `paymentStatus` is derived from it by the use case. */
  paidAmount: number;
  paymentStatus: PaymentStatus;
  dueDate?: Date | null;
  idempotencyKey?: string | null;
  method: PaymentMethod;
  currency: string;
  createdBy?: string | null;
  createdByName?: string | null;
  items: IPaymentItemCreate[];
  tenders: ITenderCreate[];
}

export interface ITenderCreate {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  idempotencyKey?: string | null;
}

export interface IActor {
  restaurantId: string;
  branchId: string;
  createdBy?: string | null;
  createdByName?: string | null;
}

export interface IRefundCreate {
  amount: number;
  method: PaymentMethod;
  tenderId?: string | null;
  reason: string;
  idempotencyKey?: string | null;
}

export interface IPaymentsFetchQuery {
  restaurantId: string;
  branchId: string;
  tableId?: string;
  paymentStatus?: PaymentStatus;
  method?: PaymentMethod;
  customerId?: string;
  from?: Date;
  to?: Date;
}

export interface IPaymentsFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class PaymentRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems>;
  abstract fetchAll(query: IPaymentsFetchQuery, options?: IPaymentsFetchOptions): Promise<PaginatedResponse<IPaymentWithItems>>;
  abstract findById(
    id: string,
    restaurantId: string,
    branchId: string,
    options?: { tx?: PrismaTransaction }
  ): Promise<IPaymentWithItems | null>;
  abstract findByIdempotencyKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems | null>;
  /**
   * Adds a collection and moves `paidAmount`/`paymentStatus` in one conditional UPDATE, so two requests
   * settling the same balance cannot both fit. Returns null when `amount` is more than is still owed.
   */
  abstract addTender(
    paymentId: string,
    actor: IActor,
    tender: ITenderCreate,
    options: { tx: PrismaTransaction }
  ): Promise<IPaymentTender | null>;
  abstract findTenderByKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentTender | null>;
  /**
   * Records a refund and its cash-book outflow together. Returns null when it would refund more than
   * has been collected. The original payment and tenders are never edited.
   */
  abstract addRefund(
    paymentId: string,
    actor: IActor,
    refund: IRefundCreate,
    options: { tx: PrismaTransaction }
  ): Promise<IPaymentRefund | null>;
  abstract findRefundByKey(restaurantId: string, key: string, options?: { tx?: PrismaTransaction }): Promise<IPaymentRefund | null>;
  abstract findBySessionId(sessionId: string): Promise<IPaymentWithItems | null>;
}
