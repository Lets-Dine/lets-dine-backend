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
import { AuthEntity } from "../../../../common/interfaces";
import { DiningSessionService } from "../../../dining-sessions/application/dining-session.service";
import { FetchSessionOrderUsecase } from "../../application/use-cases/fetch-session-order.usecase";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";

const orderRoom = (orderId: string) => `order:${orderId}`;
const restaurantQueueRoom = (restaurantId: string) => `restaurant:${restaurantId}:orders`;

interface SubscribeOrderPayload {
  orderId: string;
  sessionToken: string;
}

interface SubscribeQueuePayload {
  token: string;
}

/**
 * §38 — pushes order lifecycle events instead of either side polling.
 *
 * Two audiences share one socket connection point, each scoped to its own
 * room and only entered after proving the same credential its HTTP
 * equivalent would require:
 *
 * - A diner's status screen joins `order:{orderId}` — only after resolving
 *   the table session token it already holds and confirming that session
 *   actually placed this order (the same check `FetchSessionOrderUsecase`
 *   makes for the polling endpoint it replaces).
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
}
