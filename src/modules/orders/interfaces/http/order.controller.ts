import { Controller, Get, Headers, Param, Post, Query, UseGuards, Body } from "@nestjs/common";
import { IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { type IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { DinerSession } from "../../../dining-sessions/interfaces/http/decorators/diner-session.decorator";
import { DinerSessionGuard } from "../../../dining-sessions/interfaces/http/guards/diner-session.guard";
import { CreateOrderDto } from "../../application/dto/create-order.dto";
import { FetchOrdersDto } from "../../application/dto/fetch-orders.dto";
import { CancelOrderItemUsecase } from "../../application/use-cases/cancel-order-item.usecase";
import { CreateOrderUsecase } from "../../application/use-cases/create-order.usecase";
import { FetchSessionOrderUsecase } from "../../application/use-cases/fetch-session-order.usecase";
import { FetchSessionOrdersUsecase } from "../../application/use-cases/fetch-session-orders.usecase";
import { ORDER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";

/** The diner half of ordering — authorised by the table session, not an account. */
@Controller("orders")
@UseGuards(DinerSessionGuard)
export class OrderController {
  constructor(
    private readonly createOrderUsecase: CreateOrderUsecase,
    private readonly fetchSessionOrderUsecase: FetchSessionOrderUsecase,
    private readonly fetchSessionOrdersUsecase: FetchSessionOrdersUsecase,
    private readonly cancelOrderItemUsecase: CancelOrderItemUsecase
  ) {}

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @DinerSession() session: IDiningSession,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.createOrderUsecase.execute(dto, session, { idempotencyKey });
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_CREATED);
  }

  @Get()
  async fetchAll(
    @Query() query: FetchOrdersDto,
    @DinerSession() session: IDiningSession
  ): Promise<IHttpResponse<PaginatedResponse<IOrderWithItems>>> {
    const orders = await this.fetchSessionOrdersUsecase.execute(query, session);
    return buildHttpResponse(orders, ORDER_SUCCESS_MESSAGES.ORDERS_FETCHED);
  }

  @Get("/:id")
  async fetchById(
    @Param("id", ParseUuidPipe) id: string,
    @DinerSession() session: IDiningSession
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.fetchSessionOrderUsecase.execute(id, session);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_FETCHED);
  }

  /** §20/§27 — a diner can still pull one line of their own order before the kitchen has touched it. */
  @Post("/:orderId/items/:itemId/cancel")
  async cancelItem(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @Param("itemId", ParseUuidPipe) itemId: string,
    @DinerSession() session: IDiningSession
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.cancelOrderItemUsecase.execute(orderId, itemId, session);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_ITEM_CANCELLED);
  }
}
