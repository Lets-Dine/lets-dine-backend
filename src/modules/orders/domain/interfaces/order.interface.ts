import { OrderStatus } from "@prisma/client";

export interface IOrderItem {
  id: string;
  orderId: string;
  dishId: string;
  /** Snapshots — editing the dish later must not rewrite a placed order. */
  dishNameSnapshot: string;
  imageUrlSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  notes: string;
}

export interface IOrder {
  id: string;
  reference: string;
  restaurantId: string;
  tableId: string;
  sessionId: string;
  status: OrderStatus;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  idempotencyKey: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What both sides of the product actually render: the order, its lines, the
 * table it belongs to, and which of its dishes have already been rated — the
 * last one so the review flow knows what is still owed (§10).
 */
export interface IOrderWithItems extends IOrder {
  items: IOrderItem[];
  tableName: string;
  reviewedDishIds: string[];
}
