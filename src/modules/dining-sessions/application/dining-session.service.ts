import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException, UnauthorizedException } from "../../../common/exceptions";
import { PrismaTransaction } from "../../../common/prisma";
import { DiningTableRepository } from "../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../domain/constants";
import { IDiningSession } from "../domain/interfaces/dining-session.interface";
import { DiningSessionRepository } from "../domain/repositories/dining-session.repository";
import { AuthEntity } from "../../../common/interfaces";
import { IDiningTable } from "../../tables/domain/interfaces/dining-table.interface";
import { IOrderWithItems } from "../../orders/domain/interfaces/order.interface";
import { OrderRepository } from "../../orders/domain/repositories/order.repository";
import { calculateOrderTotals } from "../../orders/domain/utils/money.util";
import { deriveOrderStatus } from "../../orders/domain/utils/order-status.util";
import { RESTAURANT_ERROR_MESSAGES } from "../../restaurants/domain/constants";
import { RestaurantRepository } from "../../restaurants/domain/repositories/restaurant.repository";
import { AuditLogService } from "../../audit-logs/application/audit-log.service";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";

/**
 * The one place a diner's token becomes a session. Everything the diner can do —
 * ordering, reviewing — hangs off this check, so it lives in a service rather
 * than being re-implemented per use case.
 */
@Injectable()
export class DiningSessionService {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async resolveActive(token: string, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const session = await this.diningSessionRepository.findByToken(token, options);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    if (session.endedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    const table = await this.diningTableRepository.findById(session.tableId, options);
    if (!table || table.currentSessionId !== session.id) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    return session;
  }

  async endSession(session: IDiningSession, authEntity: AuthEntity, tx: PrismaTransaction): Promise<IDiningTable> {
    const closed = await this.closeOpenOrders(session.id, authEntity, tx);
    const ended = await this.diningSessionRepository.update(session.id, { endedAt: new Date() }, tx);
    const table = await this.diningTableRepository.update(session.tableId, { currentSessionId: null }, { tx });

    await this.auditLogService.record(
      {
        action: AuditAction.table_session_ended,
        subject: table.name,
        detail: closed.length > 0 ? `Table cleared — ${closingSummary(closed)}` : "Table cleared for the next visit",
      },
      authEntity,
      tx
    );

    // §22/§38 — every caller uses `endSession` as the last write in its own
    // transaction, so nothing left in-flight there could still roll this
    // back. `OrdersGateway` relays `session.ended` to the diner's own
    // `session:{id}` room — the one signal that reaches them whether or not
    // they have an order open to be watching already — and each closed
    // order's own `order.updated`, so the pass and any open status screen
    // see the same final tickets rather than the ones they last polled.
    this.eventEmitter.emit("session.ended", ended);
    for (const order of closed) this.eventEmitter.emit("order.updated", order);

    return table;
  }

  /**
   * §20/§27 — ending a visit does not un-cook food, so this is not a blanket
   * "mark everything COMPLETED": each open order's own items are reconciled
   * first, exactly as any other item mutation would, and `Order.status` is
   * re-derived from the result rather than forced. A line the kitchen never
   * started is dropped — and never billed, per the same rule a diner's own
   * item cancel already follows. A line already cooking or plated is treated
   * as delivered: the kitchen made it, and the visit is over. This is the
   * one place that skips the item state machine's normal one-step-at-a-time
   * pace (`OrderItemEntity.canTransitionTo`) — it is not simulating the
   * kitchen, it is closing the books on a visit that has already ended.
   */
  private async closeOpenOrders(sessionId: string, authEntity: AuthEntity, tx: PrismaTransaction): Promise<IOrderWithItems[]> {
    const open = await this.orderRepository.findOpenBySessionId(sessionId, authEntity.restaurantId, { tx });
    if (open.length === 0) return [];

    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId, { tx });
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const closed: IOrderWithItems[] = [];
    for (const order of open) {
      let items = order.items;
      for (const item of items) {
        if (item.status === OrderItemStatus.PENDING) {
          items = (await this.orderRepository.updateItemStatus(item.id, OrderItemStatus.CANCELLED, { tx })).items;
        } else if (item.status === OrderItemStatus.PREPARING || item.status === OrderItemStatus.READY) {
          items = (await this.orderRepository.updateItemStatus(item.id, OrderItemStatus.SERVED, { tx })).items;
        }
      }

      // A ticket staff never even accepted has no `acceptedAt` for
      // `deriveOrderStatus` to key off — without a `cancelledAt` of its own
      // it would read as still PENDING forever, so this is the one place
      // that sets it by hand (mirroring what accepting it never got to).
      const cancelledAt = order.acceptedAt ? order.cancelledAt : new Date();
      const status = deriveOrderStatus(items, order.acceptedAt, cancelledAt);
      const billable = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
      const totals = calculateOrderTotals(billable, restaurant, order.discount);

      closed.push(
        await this.orderRepository.update(
          order.id,
          { status, cancelledAt, completedAt: status === OrderStatus.COMPLETED ? new Date() : null, ...totals },
          { tx, actorId: authEntity.sub }
        )
      );
    }

    return closed;
  }
}

/** Ending a visit can close a ticket either way — never just a count of "completed". */
function closingSummary(closed: IOrderWithItems[]): string {
  const completed = closed.filter(order => order.status === OrderStatus.COMPLETED).length;
  const cancelled = closed.length - completed;
  if (cancelled === 0) return `${completed} order${completed === 1 ? "" : "s"} marked completed`;
  if (completed === 0) return `${cancelled} order${cancelled === 1 ? "" : "s"} cancelled — the kitchen never started them`;
  return `${completed} order${completed === 1 ? "" : "s"} completed, ${cancelled} cancelled`;
}
