import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException, UnauthorizedException } from "../../../common/exceptions";
import { PrismaTransaction } from "../../../common/prisma";
import { DiningTableRepository } from "../../tables/domain/repositories/dining-table.repository";
import { FloorRepository } from "../../floors/domain/repositories/floor.repository";
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
    private readonly floorRepository: FloorRepository,
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async resolveActive(token: string, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const session = await this.diningSessionRepository.findByToken(token, options);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    if (session.endedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
    }

    // A delivery session has no table to reconcile against — its expiry above is the only gate.
    if (session.tableId) {
      const table = await this.diningTableRepository.findById(session.tableId, options);
      if (!table || table.currentSessionId !== session.id) {
        throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED);
      }
    }

    return session;
  }

  /**
   * §10 — a diner rating a dish, or checking an order, is asking about the
   * past, not the table's current state — so unlike `resolveActive`, ending
   * or expiring the visit is not a reason to reject the token. Only a token
   * that never resolved to a real session is. Ownership of any particular
   * order/review still comes from that session's id, checked by the caller.
   */
  async resolveAny(token: string, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const session = await this.diningSessionRepository.findByToken(token, options);
    if (!session) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);

    return session;
  }

  async endSession(session: IDiningSession, authEntity: AuthEntity, tx: PrismaTransaction): Promise<IDiningTable | null> {
    const closed = await this.closeOpenOrders(session.id, authEntity, tx);
    const ended = await this.diningSessionRepository.update(session.id, { endedAt: new Date() }, tx);
    // A delivery or floor session has no table to free up.
    const table = session.tableId ? await this.diningTableRepository.update(session.tableId, { currentSessionId: null }, { tx }) : null;
    // A floor has no singleton to clear — the session ending is the whole story for it.
    const floor = session.floorId ? await this.floorRepository.findById(session.floorId, { tx }) : null;
    const subject = table?.name ?? floor?.name ?? "Delivery session";

    await this.auditLogService.record(
      {
        action: AuditAction.table_session_ended,
        subject,
        detail:
          closed.length > 0
            ? `${table ? "Table cleared" : "Session ended"} — ${closingSummary(closed)}`
            : `${table ? "Table cleared" : "Session ended"} for the next visit`,
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
      // Ending the visit is not the same as paying it — a floor order whose bill was never taken
      // lands on UNPAID here, not COMPLETED, same as any other item-driven transition (§16b).
      const status = deriveOrderStatus(items, cancelledAt, order.orderType, {
        isFloorOrder: Boolean(order.floorId),
        paidAt: order.paidAt,
      });
      const billable = items.filter(item => item.status !== OrderItemStatus.CANCELLED);
      const totals = calculateOrderTotals(billable, restaurant, order.discount, order.deliveryFee ?? 0);

      closed.push(
        await this.orderRepository.update(
          order.id,
          { status: status ?? order.status, cancelledAt, completedAt: status === OrderStatus.COMPLETED ? new Date() : null, ...totals },
          { tx, actorId: authEntity.sub }
        )
      );
    }

    return closed;
  }
}

/** Ending a visit can close a ticket three ways — never just a count of "completed". */
function closingSummary(closed: IOrderWithItems[]): string {
  const completed = closed.filter(order => order.status === OrderStatus.COMPLETED).length;
  const unpaid = closed.filter(order => order.status === OrderStatus.UNPAID).length;
  const cancelled = closed.length - completed - unpaid;
  const parts = [
    completed > 0 && `${completed} order${completed === 1 ? "" : "s"} completed`,
    unpaid > 0 && `${unpaid} left unpaid`,
    cancelled > 0 && `${cancelled} cancelled — the kitchen never started ${cancelled === 1 ? "it" : "them"}`,
  ].filter((part): part is string => Boolean(part));
  return parts.join(", ");
}
