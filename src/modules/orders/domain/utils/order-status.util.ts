import { OrderItemStatus, OrderStatus } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/**
 * §20/§27 — `Order.status` is no longer set directly once an order is
 * accepted; it is read off its items. Every mutation that touches acceptance,
 * item status or item cancellation must finish by calling this and persisting
 * the result, so every reader (kitchen pass, diner tracker, billing) sees one
 * consistent value.
 */
export function deriveOrderStatus(
  items: Pick<{ status: OrderItemStatus }, "status">[],
  acceptedAt: Date | null,
  cancelledAt: Date | null
): OrderStatus {
  if (cancelledAt) return OrderStatus.CANCELLED;
  if (!acceptedAt) return OrderStatus.PENDING;

  const live = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
  if (live.length === 0) return OrderStatus.CANCELLED;
  if (live.every(item => item.status === OrderItemStatus.SERVED)) return OrderStatus.COMPLETED;
  if (live.every(item => item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED)) return OrderStatus.READY;
  if (live.some(item => item.status !== OrderItemStatus.PENDING)) return OrderStatus.PREPARING;
  return OrderStatus.ACCEPTED;
}
