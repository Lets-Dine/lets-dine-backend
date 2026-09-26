import { PaymentMethod } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IPaymentWithItems } from "../interfaces/payment.interface";

export interface IPaymentItemCreate {
  dishId: string;
  dishNameSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface IPaymentCreate {
  restaurantId: string;
  sessionId: string;
  tableId: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
  method: PaymentMethod;
  currency: string;
  createdBy?: string | null;
  items: IPaymentItemCreate[];
}

export interface IPaymentsFetchQuery {
  restaurantId: string;
  tableId?: string;
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
  abstract findById(id: string, restaurantId: string): Promise<IPaymentWithItems | null>;
  abstract findBySessionId(sessionId: string): Promise<IPaymentWithItems | null>;
}
