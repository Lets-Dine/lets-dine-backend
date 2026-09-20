import { OrderStatus } from "@prisma/client";

/** A table is "in use" while any of its orders are still moving through the kitchen. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

export function isOrderOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}
