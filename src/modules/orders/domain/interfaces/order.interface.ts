import { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";

export interface IOrderItemAddOn {
  addOnId: string;
  /** Snapshots — editing or archiving the add-on later must not rewrite a placed order. */
  nameSnapshot: string;
  priceSnapshot: number;
}

export interface IOrderItem {
  id: string;
  orderId: string;
  dishId: string;
  /** Snapshots — editing the dish later must not rewrite a placed order. */
  dishNameSnapshot: string;
  imageUrlSnapshot: string | null;
  /** Dish price plus every selected add-on's price, for one unit. */
  unitPrice: number;
  quantity: number;
  notes: string;
  status: OrderItemStatus;
  statusUpdatedAt: Date;
  addOns: IOrderItemAddOn[];
  /** The selected DishVariant, if the dish had any — null otherwise. Snapshots, same reasoning as dishNameSnapshot. */
  variantId: string | null;
  variantNameSnapshot: string | null;
  variantPriceSnapshot: number | null;
}

export interface IOrder {
  id: string;
  reference: string;
  restaurantId: string;
  /** Null for a delivery order — see `orderType`. */
  tableId: string | null;
  sessionId: string;
  orderType: OrderType;
  /** Set only for a delivery order, placed by a recognised `Customer`. */
  customerId: string | null;
  status: OrderStatus;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  /** A flat delivery charge, snapshotted from `Restaurant.deliveryFeeAmount` at order time. */
  deliveryFee: number | null;
  total: number;
  currency: string;
  /** Snapshots taken at order time — editing the `Customer` row later must not rewrite a placed order. */
  deliveryAddress: string | null;
  deliveryPhone: string | null;
  deliveryCustomerName: string | null;
  deliveryNote: string | null;
  idempotencyKey: string | null;
  cancelReason: string | null;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What both sides of the product actually render: the order, its lines, the
 * table it belongs to (null for delivery), and which of its dishes have
 * already been rated — the last one so the review flow knows what is still
 * owed (§10).
 */
export interface IOrderWithItems extends IOrder {
  items: IOrderItem[];
  tableName: string | null;
  reviewedDishIds: string[];
}
