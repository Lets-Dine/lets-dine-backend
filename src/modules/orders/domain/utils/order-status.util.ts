import { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen — or still waiting on their bill. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.SETTLE,
  OrderStatus.UNPAID,
];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/** The bit of an order's payment state `deriveOrderStatus` needs — nothing else about it. */
export interface DeriveOrderStatusContext {
  /** Set once the order's bill is paid: its own (`CompletePaymentUsecase`, scoped to one order) or the table's tab it was on. */
  paidAt?: Date | null;
}

/**
 * §20 — item statuses drive `Order.status` automatically for a dine-in
 * order, all the way through to COMPLETED once every item is SERVED.
 *
 * A dine-in order doesn't skip straight to COMPLETED there, though — it sits
 * at `UNPAID` until `paidAt` is set: by `CompletePaymentUsecase` for a floor
 * order's own bill, or when the table's tab is settled (`endSession`, paid).
 * A delivery order has no such gap.
 *
 * A delivery order caps at READY instead: dispatch and hand-over aren't
 * things any one item's status can tell you, so `OUT_FOR_DELIVERY`, `SETTLE` and
 * `COMPLETED` are reached only by the manual steps in `UpdateOrderStatusUsecase`,
 * `DeliverOrderUsecase` and `SettleDeliveryOrderUsecase` — never derived here.
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
    return context.paidAt ? OrderStatus.COMPLETED : OrderStatus.UNPAID;
  }
  if (live.every(item => item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED)) return OrderStatus.READY;
  if (live.some(item => item.status !== OrderItemStatus.PENDING)) return OrderStatus.PREPARING;

  return null;
}
