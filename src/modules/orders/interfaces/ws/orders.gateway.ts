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
import { can } from "../../../../common/auth";
import { type AuthEntity } from "../../../../common/interfaces";
import { DiningSessionService } from "../../../dining-sessions/application/dining-session.service";
import { type IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { FetchSessionOrderUsecase } from "../../application/use-cases/fetch-session-order.usecase";
import { type IOrderWithItems } from "../../domain/interfaces/order.interface";

const orderRoom = (orderId: string) => `order:${orderId}`;
const restaurantQueueRoom = (restaurantId: string) => `restaurant:${restaurantId}:orders`;
const sessionRoom = (sessionId: string) => `session:${sessionId}`;

interface SubscribeOrderPayload {
  orderId: string;
  sessionToken: string;
}

interface SubscribeQueuePayload {
  token: string;
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
 * - The restaurant's pass joins `restaurant:{restaurantId}:orders` — only
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
    private readonly jwtService: JwtService
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
      await client.join(restaurantQueueRoom(authEntity.restaurantId));
      client.emit("subscribe:ok", { scope: "queue", restaurantId: authEntity.restaurantId });
    } catch {
      client.emit("subscribe:error", { scope: "queue", message: "Your session has ended. Please sign in again." });
    }
  }

  /** A brand-new ticket — the diner already has it from the create response, so only the pass needs telling. */
  @OnEvent("order.created")
  handleOrderCreated(order: IOrderWithItems): void {
    this.server.to(restaurantQueueRoom(order.restaurantId)).emit("order.created", order);
  }

  /** A status change or cancellation — both the diner tracking it and the pass watching the queue need the update. */
  @OnEvent("order.updated")
  handleOrderUpdated(order: IOrderWithItems): void {
    this.server.to(orderRoom(order.id)).to(restaurantQueueRoom(order.restaurantId)).emit("order.updated", order);
  }

  /** Staff closed the table out (or a payment settled it) — the diner on it can no longer place another order. */
  @OnEvent("session.ended")
  handleSessionEnded(session: IDiningSession): void {
    this.server.to(sessionRoom(session.id)).emit("session.ended", session);
  }
}
