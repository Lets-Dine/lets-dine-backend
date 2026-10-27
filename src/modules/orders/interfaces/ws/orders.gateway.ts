import { Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { can, StaffAccessPolicy } from "../../../../common/auth";
import { ForbiddenException } from "../../../../common/exceptions";
import { type AuthEntity } from "../../../../common/interfaces";
import { KitchenStation } from "@prisma/client";
import { SUBSCRIPTION_LOCKED_EVENT } from "../../../billing/domain/constants";
import { DiningSessionService } from "../../../dining-sessions/application/dining-session.service";
import { type IDiningSession, type IServiceRequest } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { KITCHEN_TICKET_CREATED, KITCHEN_TICKET_READY, KITCHEN_TICKET_UPDATED } from "../../application/kitchen-ticket.service";
import { FetchSessionOrderUsecase } from "../../application/use-cases/fetch-session-order.usecase";
import { type IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";
import { type IOrderWithItems } from "../../domain/interfaces/order.interface";

const orderRoom = (orderId: string) => `order:${orderId}`;
const restaurantQueueRoom = (restaurantId: string, branchId: string) => `restaurant:${restaurantId}:branch:${branchId}:orders`;
const stationRoom = (restaurantId: string, branchId: string, station: KitchenStation) =>
  `restaurant:${restaurantId}:branch:${branchId}:station:${station}`;
const sessionRoom = (sessionId: string) => `session:${sessionId}`;

interface SubscribeOrderPayload {
  orderId: string;
  sessionToken: string;
}

interface SubscribeQueuePayload {
  token: string;
}

interface SubscribeStationPayload {
  token: string;
  station: KitchenStation;
}

interface SubscribeSessionPayload {
  sessionToken: string;
}

/**
 * §38 — pushes order lifecycle events instead of either side polling.
 *
 * Three audiences share one socket connection point, each scoped to its own
 * room and only entered after proving the same credential its HTTP
 * equivalent would require:
 *
 * - A diner's status screen joins `order:{orderId}` — only after resolving
 *   the table session token it already holds and confirming that session
 *   actually placed this order (the same check `FetchSessionOrderUsecase`
 *   makes for the polling endpoint it replaces).
 * - A diner's whole visit joins `session:{sessionId}` the moment the table
 *   is resolved — before any order exists to watch. It is the only channel
 *   that reaches a diner who is still just browsing the menu when staff
 *   closes the table out from under them.
 * - The restaurant's pass joins `restaurant:{restaurantId}:branch:{branchId}:orders` — only
 *   after verifying the staff JWT and the `orders:view` permission.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly diningSessionService: DiningSessionService,
    private readonly fetchSessionOrderUsecase: FetchSessionOrderUsecase,
    private readonly jwtService: JwtService,
    private readonly staffAccessPolicy: StaffAccessPolicy
  ) {}

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe:order")
  async subscribeToOrder(@ConnectedSocket() client: Socket, @MessageBody() payload: SubscribeOrderPayload): Promise<void> {
    try {
      const session = await this.diningSessionService.resolveActive(payload.sessionToken);
      await this.fetchSessionOrderUsecase.execute(payload.orderId, session);
      await client.join(orderRoom(payload.orderId));
      client.emit("subscribe:ok", { scope: "order", orderId: payload.orderId });
    } catch {
      // Wrong session, unknown order, or a session that has since expired —
      // the diner screen shows the same "order not found" it would from a
      // failed poll, so the reason does not need to survive the socket hop.
      client.emit("subscribe:error", { scope: "order", message: "That order could not be found." });
    }
  }

  @SubscribeMessage("subscribe:session")
  async subscribeToSession(@ConnectedSocket() client: Socket, @MessageBody() payload: SubscribeSessionPayload): Promise<void> {
    try {
      const session = await this.diningSessionService.resolveActive(payload.sessionToken);
      await client.join(sessionRoom(session.id));
      client.emit("subscribe:ok", { scope: "session", sessionId: session.id });
    } catch {
      // Already ended or expired — the caller's own resync (fired on this
      // same ack) refetches over HTTP and reads that as "ended" itself, so
      // this does not need to carry the reason.
      client.emit("subscribe:error", { scope: "session", message: "This table's session has ended." });
    }
  }

  @SubscribeMessage("subscribe:queue")
  async subscribeToQueue(@ConnectedSocket() client: Socket, @MessageBody() payload: SubscribeQueuePayload): Promise<void> {
    try {
      const authEntity = await this.jwtService.verifyAsync<AuthEntity>(payload.token);
      if (!can(authEntity.role, "orders:view")) {
        client.emit("subscribe:error", { scope: "queue", message: "You do not have permission to view orders." });
        return;
      }
      // A suspended restaurant gets no live pass — the token alone would still verify for days.
      await this.staffAccessPolicy.assertCanAccess(authEntity);
      // A socket watches one branch's pass at a time — switching branch must not keep the old one's tickets flowing.
      for (const room of client.rooms) if (room.endsWith(":orders")) await client.leave(room);
      await client.join(restaurantQueueRoom(authEntity.restaurantId, authEntity.branchId));
      client.emit("subscribe:ok", { scope: "queue", restaurantId: authEntity.restaurantId, branchId: authEntity.branchId });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        client.emit("subscribe:error", { scope: "queue", message: error.message });
        return;
      }
      client.emit("subscribe:error", { scope: "queue", message: "Your session has ended. Please sign in again." });
    }
  }

  /**
   * A kitchen or bar screen, or a PC printing its slips: that station's tickets, behind the same staff credential
   * as the pass. A socket may join both stations (one PC printing both), so clients ignore any other station's tickets.
   */
  @SubscribeMessage("subscribe:station")
  async subscribeToStation(@ConnectedSocket() client: Socket, @MessageBody() payload: SubscribeStationPayload): Promise<void> {
    try {
      if (!Object.values(KitchenStation).includes(payload.station)) throw new Error("unknown station");
      const authEntity = await this.jwtService.verifyAsync<AuthEntity>(payload.token);
      if (!can(authEntity.role, "orders:view")) {
        client.emit("subscribe:error", { scope: "station", message: "You do not have permission to view orders." });
        return;
      }
      await this.staffAccessPolicy.assertCanAccess(authEntity);
      await client.join(stationRoom(authEntity.restaurantId, authEntity.branchId, payload.station));
      client.emit("subscribe:ok", { scope: "station", station: payload.station, branchId: authEntity.branchId });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        client.emit("subscribe:error", { scope: "station", message: error.message });
        return;
      }
      client.emit("subscribe:error", { scope: "station", message: "Your session has ended. Please sign in again." });
    }
  }

  /**
   * The restaurant was suspended or cancelled: staff already watching the pass are put out of it. Joining
   * again is refused (see `subscribe:queue`), so the socket stays out until the account is restored.
   */
  @OnEvent(SUBSCRIPTION_LOCKED_EVENT)
  async handleSubscriptionLocked({ restaurantId }: { restaurantId: string }): Promise<void> {
    const prefix = `restaurant:${restaurantId}:`;
    const rooms = [...this.server.sockets.adapter.rooms.keys()].filter(room => room.startsWith(prefix));

    for (const room of rooms) {
      this.server.in(room).emit("subscribe:error", { scope: "queue", message: "This restaurant's subscription is suspended." });
      await this.server.in(room).socketsLeave(room);
    }
  }

  /** A brand-new ticket — the diner already has it from the create response, so only the pass needs telling. */
  @OnEvent("order.created")
  handleOrderCreated(order: IOrderWithItems): void {
    this.server.to(restaurantQueueRoom(order.restaurantId, order.branchId)).emit("order.created", order);
  }

  /** A status change or cancellation — both the diner tracking it and the pass watching the queue need the update. */
  @OnEvent("order.updated")
  handleOrderUpdated(order: IOrderWithItems): void {
    this.server.to(orderRoom(order.id)).to(restaurantQueueRoom(order.restaurantId, order.branchId)).emit("order.updated", order);
  }

  /** New work (or a void) for one station — only that station's screens hear it. */
  @OnEvent(KITCHEN_TICKET_CREATED)
  handleKitchenTicketCreated(ticket: IKitchenTicket): void {
    this.emitToStation(ticket, KITCHEN_TICKET_CREATED);
  }

  /** Someone acknowledged it — every screen on that station drops its "unseen" marker. */
  @OnEvent(KITCHEN_TICKET_UPDATED)
  handleKitchenTicketUpdated(ticket: IKitchenTicket): void {
    this.emitToStation(ticket, KITCHEN_TICKET_UPDATED);
  }

  /** The station finished it — the pass (waiters) hears it through the same fan-out, to come and get it. */
  @OnEvent(KITCHEN_TICKET_READY)
  handleKitchenTicketReady(ticket: IKitchenTicket): void {
    this.emitToStation(ticket, KITCHEN_TICKET_READY);
  }

  private emitToStation(ticket: IKitchenTicket, event: string): void {
    // A ticket row carries its branch, not its restaurant — the room name needs both. The pass
    // (queue room) hears it too, to warn when the station never acknowledges.
    const rooms = [...this.server.sockets.adapter.rooms.keys()].filter(
      room => room.endsWith(`:branch:${ticket.branchId}:station:${ticket.station}`) || room.endsWith(`:branch:${ticket.branchId}:orders`)
    );
    for (const room of rooms) this.server.to(room).emit(event, ticket);
  }

  /** Staff closed the table out (or a payment settled it) — the diner on it can no longer place another order. */
  @OnEvent("session.ended")
  handleSessionEnded(session: IDiningSession): void {
    this.server.to(sessionRoom(session.id)).emit("session.ended", session);
  }

  /** A diner asked for a waiter or the bill (or staff cleared it) — every pass tab on that branch updates at once. */
  @OnEvent("service.requested")
  handleServiceRequested(request: IServiceRequest): void {
    this.server.to(restaurantQueueRoom(request.restaurantId, request.branchId)).emit("service.requested", request);
  }
}
