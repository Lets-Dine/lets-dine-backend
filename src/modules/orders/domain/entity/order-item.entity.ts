import { OrderItemStatus } from "@prisma/client";
import { IOrderItem } from "../interfaces/order.interface";

/**
 * §20 — the unit that actually moves through the kitchen. One line only ever
 * advances forward, and a served or cancelled line never moves again.
 */
const ALLOWED_ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  [OrderItemStatus.PENDING]: [OrderItemStatus.PREPARING, OrderItemStatus.CANCELLED],
  [OrderItemStatus.PREPARING]: [OrderItemStatus.READY],
  [OrderItemStatus.READY]: [OrderItemStatus.SERVED],
  [OrderItemStatus.SERVED]: [],
  [OrderItemStatus.CANCELLED]: [],
};

export class OrderItemEntity {
  constructor(private readonly item: IOrderItem) {}

  get status(): OrderItemStatus {
    return this.item.status;
  }

  canTransitionTo(next: OrderItemStatus): boolean {
    return ALLOWED_ITEM_TRANSITIONS[this.item.status].includes(next);
  }

  nextStatuses(): OrderItemStatus[] {
    return ALLOWED_ITEM_TRANSITIONS[this.item.status];
  }

  /** A diner can pull their own line before the kitchen has touched it — after that it is food. */
  isCancellable(): boolean {
    return this.item.status === OrderItemStatus.PENDING;
  }

  belongsToOrder(orderId: string): boolean {
    return this.item.orderId === orderId;
  }
}
