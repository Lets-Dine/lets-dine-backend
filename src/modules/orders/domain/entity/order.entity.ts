import { OrderItemStatus, OrderStatus } from "@prisma/client";
import { IOrder, IOrderItem } from "../interfaces/order.interface";

/**
 * §20 — the pass only moves one way, and a finished or cancelled ticket never
 * moves again. Keeping the rule here means every caller enforces the same one.
 *
 * Since items now carry their own status, `status` here only still moves by
 * hand for `PENDING → ACCEPTED` (the one whole-order action staff take) and
 * `→ CANCELLED` (whole-order cancel, gated further by `isCancellable` below).
 * `PREPARING`/`READY`/`COMPLETED` are reached by `deriveOrderStatus`, not by a
 * direct transition through this table.
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

  /**
   * §27 — staff can still pull the whole ticket before the kitchen has
   * touched any of it; once a single item has left PENDING, cancelling the
   * rest would waste food/work already in progress on the others, so only
   * that one item can be cancelled from then on (via `OrderItemEntity`).
   */
  isCancellable(items: Pick<IOrderItem, "status">[] = []): boolean {
    if (!this.canTransitionTo(OrderStatus.CANCELLED)) return false;
    return !this.hasStartedItems(items);
  }

  hasStartedItems(items: Pick<IOrderItem, "status">[]): boolean {
    return items.some(item => item.status !== OrderItemStatus.PENDING);
  }

  /**
   * §10 — a dish earns the right to be rated the moment it is actually
   * served, not once the rest of the table's order finishes: a starter that
   * arrived twenty minutes ago shouldn't wait on dessert. A whole-order
   * cancel takes that right away outright, whatever any surviving item says.
   */
  isDishReviewable(items: Pick<IOrderItem, "dishId" | "status">[], dishId: string): boolean {
    if (this.order.status === OrderStatus.CANCELLED) return false;
    return items.some(item => item.dishId === dishId && item.status === OrderItemStatus.SERVED);
  }

  belongsToSession(sessionId: string): boolean {
    return this.order.sessionId === sessionId;
  }
}
