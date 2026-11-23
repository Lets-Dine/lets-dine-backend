import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { OrderType } from "@prisma/client";
import { type IServiceRequest } from "../../dining-sessions/domain/interfaces/dining-session.interface";
import { type IOrderWithItems } from "../../orders/domain/interfaces/order.interface";
import { ORDER_ITEM_READY, ORDER_PLACED_BY_DINER, SERVICE_RAISED } from "../domain/constants";
import { NotificationService } from "./notification.service";

/** Ready lines of one order arrive together (a whole ticket at once): one push, not one per line. */
const READY_QUIET_MS = 5000;

const where = (order: IOrderWithItems) =>
  order.orderType === OrderType.DELIVERY
    ? "Delivery"
    : order.orderType === OrderType.PICKUP
      ? "Pickup"
      : (order.tableName ?? order.floorName ?? "Dine-in");

/** Turns the events the live screens already use into pushes. Only the three that need a person to act. */
@Injectable()
export class NotificationListener {
  private readonly lastReady = new Map<string, number>();

  constructor(private readonly notifications: NotificationService) {}

  @OnEvent(ORDER_PLACED_BY_DINER)
  onOrderPlaced(order: IOrderWithItems): Promise<void> {
    return this.notifications.notifyBranch(order, "orders:view", {
      title: `New order ${order.reference}`,
      body: where(order),
      data: { type: "order.created", orderId: order.id },
      collapseKey: `order:${order.id}`,
    });
  }

  @OnEvent(ORDER_ITEM_READY)
  onItemReady(order: IOrderWithItems): Promise<void> {
    const now = Date.now();
    if (now - (this.lastReady.get(order.id) ?? 0) < READY_QUIET_MS) return Promise.resolve();
    this.lastReady.set(order.id, now);
    // Keeps the map from growing for the life of the process.
    for (const [id, at] of this.lastReady) if (now - at > 60_000) this.lastReady.delete(id);
    return this.notifications.notifyBranch(order, "orders:advance", {
      title: "Ready to serve",
      body: `${where(order)} · ${order.reference}`,
      data: { type: "order.ready", orderId: order.id },
      collapseKey: `ready:${order.id}`,
    });
  }

  @OnEvent(SERVICE_RAISED)
  onServiceRaised({ request, kind }: { request: IServiceRequest; kind: "waiter" | "bill" }): Promise<void> {
    return this.notifications.notifyBranch(request, "orders:advance", {
      title: kind === "bill" ? "Bill requested" : "Waiter called",
      body: request.label,
      data: { type: kind === "bill" ? "service.bill" : "service.waiter", sessionId: request.sessionId },
      collapseKey: `service:${request.sessionId}:${kind}`,
    });
  }
}
