import { PaymentMethod } from "@prisma/client";

export interface IPaymentItem {
  id: string;
  paymentId: string;
  dishId: string;
  dishNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  createdAt: Date;
}

export interface IPayment {
  id: string;
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
  createdAt: Date;
  createdBy: string | null;
}

/** What both the receipt and any later lookup actually need: the charge and exactly what it was for. */
export interface IPaymentWithItems extends IPayment {
  items: IPaymentItem[];
}
