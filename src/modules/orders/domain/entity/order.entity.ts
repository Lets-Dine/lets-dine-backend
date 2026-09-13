import { OrderStatus } from "@prisma/client";
import { IOrder } from "../interfaces/order.interface";

/**
 * §20 — the pass only moves one way, and a finished or cancelled ticket never
 * moves again. Keeping the rule here means every caller enforces the same one.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export class Order {
  constructor(private readonly order: IOrder) {}

  get status(): OrderStatus {
    return this.order.status;
  }

  canTransitionTo(next: OrderStatus): boolean {
    return ALLOWED_TRANSITIONS[this.order.status].includes(next);
  }

  nextStatuses(): OrderStatus[] {
    return ALLOWED_TRANSITIONS[this.order.status];
  }

  isCancellable(): boolean {
    return this.canTransitionTo(OrderStatus.CANCELLED);
  }

  /** §10 — only a completed order earns the right to rate what it contained. */
  isReviewable(): boolean {
    return this.order.status === OrderStatus.COMPLETED;
  }

  belongsToSession(sessionId: string): boolean {
    return this.order.sessionId === sessionId;
  }
}
