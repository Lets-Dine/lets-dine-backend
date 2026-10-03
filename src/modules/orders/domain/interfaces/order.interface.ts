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
  /** The branch that took and fulfils this order; its reference sequence and fee overrides are the branch's. */
  branchId: string;
  /** Null for a delivery order — see `orderType`. */
  tableId: string | null;
  sessionId: string;
  /** §16b — set only for a floor order, directly rather than joined in through the session. The
   *  authoritative "is this a floor order" signal — prefer it over `floorName` for that check. */
  floorId: string | null;
  orderType: OrderType;
  /** Set for a delivery order's own `Customer`, or a floor order's recognised one (§16b) — null for a table order. */
  customerId: string | null;
  /** The linked customer's current name/phone — only the per-session read (`findBySessionId`) joins them in. */
  customerName?: string | null;
  customerPhone?: string | null;
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
  /** Floor orders only — which cabin/room/spot on the floor to bring this order to, typed in at checkout (§16b) and snapshotted here. */
  floorVisitorName: string | null;
  idempotencyKey: string | null;
  cancelReason: string | null;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  /** Floor orders only (§16b) — set once that order's own bill is paid. Null for a table or
   *  delivery order, neither of which pass through `UNPAID` on the way to `COMPLETED`. */
  paidAt: Date | null;
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
  /** Floor orders only — the floor's own name (e.g. "3rd Floor"), joined in through `floorId` at read time; not a stored column itself. */
  floorName: string | null;
  reviewedDishIds: string[];
}
