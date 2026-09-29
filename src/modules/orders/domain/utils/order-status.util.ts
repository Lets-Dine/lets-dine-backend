import { OrderItemStatus, OrderStatus } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

export function deriveOrderStatus(items: Pick<{ status: OrderItemStatus }, "status">[], cancelledAt: Date | null): OrderStatus {
  if (cancelledAt) return OrderStatus.CANCELLED;

  const live = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
  if (live.length === 0) return OrderStatus.CANCELLED;
  if (live.every(item => item.status === OrderItemStatus.SERVED)) return OrderStatus.COMPLETED;
  if (live.every(item => item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED)) return OrderStatus.READY;
  if (live.some(item => item.status !== OrderItemStatus.PENDING)) return OrderStatus.PREPARING;
  return OrderStatus.ACCEPTED;
}
