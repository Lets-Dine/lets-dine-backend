import { OrderItemStatus, OrderType } from "@prisma/client";
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
  constructor(
    private readonly item: IOrderItem,
    private readonly orderType: OrderType = OrderType.DINE_IN
  ) {}

  get status(): OrderItemStatus {
    return this.item.status;
  }

  canTransitionTo(next: OrderItemStatus): boolean {
    return this.nextStatuses().includes(next);
  }

  /**
   * A delivery order has no server to hand a plated dish to — the driver
   * takes the whole order at once, so no single line goes SERVED on its own.
   * `SettleDeliveryOrderUsecase` moves every READY line to SERVED together
   * the moment the order itself is marked delivered.
   */
  nextStatuses(): OrderItemStatus[] {
    const allowed = ALLOWED_ITEM_TRANSITIONS[this.item.status];
    if (this.orderType === OrderType.DELIVERY) return allowed.filter(status => status !== OrderItemStatus.SERVED);
    return allowed;
  }

  /** A diner can pull their own line before the kitchen has touched it — after that it is food. */
  isCancellable(): boolean {
    return this.item.status === OrderItemStatus.PENDING;
  }

  belongsToOrder(orderId: string): boolean {
    return this.item.orderId === orderId;
  }
}
