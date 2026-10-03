import { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen — or, for a
 *  floor order, still waiting on its own bill (§16b). */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.UNPAID,
];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/** The bits of a floor order's payment state `deriveOrderStatus` needs — nothing else about it. */
export interface DeriveOrderStatusContext {
  /** §16b — whether this order was placed through a floor's shared QR, not a table's. `UNPAID`
   *  only ever applies here; a table or delivery order skips straight to `COMPLETED`. */
  isFloorOrder?: boolean;
  /** Set once a floor order's own bill is paid (`CompletePaymentUsecase`, scoped to one order). */
  paidAt?: Date | null;
}

/**
 * §20 — item statuses drive `Order.status` automatically for a dine-in
 * order, all the way through to COMPLETED once every item is SERVED.
 *
 * A floor order (§16b) doesn't skip straight to COMPLETED there, though —
 * unlike a table's tab (settled as a whole, independent of any one order's
 * status) a floor order is billed on its own, so it sits at `UNPAID` until
 * `CompletePaymentUsecase` sets `paidAt` for that specific order. A table or
 * delivery order has no such gap.
 *
 * A delivery order caps at READY instead: dispatch and hand-over aren't
 * things any one item's status can tell you, so `OUT_FOR_DELIVERY` and
 * `COMPLETED` are reached only by the manual overrides in
 * `UpdateOrderStatusUsecase`/`SettleDeliveryOrderUsecase` — never derived here.
 */
export function deriveOrderStatus(
  items: Pick<{ status: OrderItemStatus }, "status">[],
  cancelledAt: Date | null,
  orderType: OrderType = OrderType.DINE_IN,
  context: DeriveOrderStatusContext = {}
): OrderStatus | null {
  if (cancelledAt) return OrderStatus.CANCELLED;

  const live = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
  if (live.length === 0) return OrderStatus.CANCELLED;
  if (live.every(item => item.status === OrderItemStatus.SERVED)) {
    if (orderType === OrderType.DELIVERY) return OrderStatus.READY;
    if (context.isFloorOrder) return context.paidAt ? OrderStatus.COMPLETED : OrderStatus.UNPAID;
    return OrderStatus.COMPLETED;
  }
  if (live.every(item => item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED)) return OrderStatus.READY;
  if (live.some(item => item.status !== OrderItemStatus.PENDING)) return OrderStatus.PREPARING;

  return null;
}
