import { PaymentMethod, PaymentStatus, TenderStatus } from "@prisma/client";

export interface IPaymentItem {
  id: string;
  paymentId: string;
  dishId: string;
  dishNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  createdAt: Date;
}

/** One collection against a sale. Only SUCCEEDED ones are money received. */
export interface IPaymentTender {
  id: string;
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  status: TenderStatus;
  reference: string;
  paidAt: Date;
  createdByName: string | null;
}

export interface IPaymentRefund {
  id: string;
  paymentId: string;
  tenderId: string | null;
  amount: number;
  method: PaymentMethod;
  reason: string;
  createdAt: Date;
  createdByName: string | null;
}

export interface IPayment {
  id: string;
  restaurantId: string;
  branchId: string;
  sessionId: string;
  /** Null for a delivery order settled individually — nothing to batch by table. */
  tableId: string | null;
  /** §16b — set only for a floor order's own bill, same reasoning as `Order.floorId`. */
  floorId: string | null;
  /** Who paid — the customer the settled orders were placed under, if any. */
  customerId: string | null;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
  /** Collected so far; `total - paidAmount` is what the customer still owes. */
  paidAmount: number;
  refundedAmount: number;
  paymentStatus: PaymentStatus;
  dueDate: Date | null;
  method: PaymentMethod;
  currency: string;
  createdAt: Date;
  createdBy: string | null;
  createdByName: string | null;
}

/** What both the receipt and any later lookup actually need: the charge and exactly what it was for. */
export interface IPaymentWithItems extends IPayment {
  items: IPaymentItem[];
  tenders: IPaymentTender[];
  refunds: IPaymentRefund[];
  /** The paying customer's name, joined in read-side for the receipt; null when no customer is linked. */
  customerName: string | null;
}

export interface IPaymentsSummary {
  count: number;
  sold: number;
  collected: number;
  refunded: number;
  /** `sold − collected`; a payment's collected amount never exceeds its total. */
  owed: number;
}
