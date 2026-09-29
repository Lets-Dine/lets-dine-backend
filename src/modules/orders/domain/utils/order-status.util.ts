import { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/**
 * §20 — item statuses drive `Order.status` automatically for a dine-in
 * order, all the way through to COMPLETED once every item is SERVED.
 *
 * A delivery order caps at READY instead: dispatch and hand-over aren't
 * things any one item's status can tell you, so `OUT_FOR_DELIVERY` and
 * `COMPLETED` are reached only by the manual overrides in
 * `UpdateOrderStatusUsecase`/`SettleDeliveryOrderUsecase` — never derived here.
 */
export function deriveOrderStatus(
  items: Pick<{ status: OrderItemStatus }, "status">[],
  cancelledAt: Date | null,
  orderType: OrderType = OrderType.DINE_IN
): OrderStatus | null {
  if (cancelledAt) return OrderStatus.CANCELLED;

  const live = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
  if (live.length === 0) return OrderStatus.CANCELLED;
  if (live.every(item => item.status === OrderItemStatus.SERVED)) {
    return orderType === OrderType.DELIVERY ? OrderStatus.READY : OrderStatus.COMPLETED;
  }
  if (live.every(item => item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED)) return OrderStatus.READY;
  if (live.some(item => item.status !== OrderItemStatus.PENDING)) return OrderStatus.PREPARING;

  return null;
}
