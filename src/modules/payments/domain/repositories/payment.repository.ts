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
  currency: string;
  createdBy?: string | null;
  items: IPaymentItemCreate[];
}

export abstract class PaymentRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems>;
}
