import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { AddOrderItemDto } from "../../application/dto/add-order-item.dto";
import { CancelOrderDto } from "../../application/dto/cancel-order.dto";
import { FetchOrdersDto } from "../../application/dto/fetch-orders.dto";
import { UpdateOrderStatusDto } from "../../application/dto/update-order-status.dto";
import { AddOrderItemUsecase } from "../../application/use-cases/add-order-item.usecase";
import { CancelOrderUsecase } from "../../application/use-cases/cancel-order.usecase";
import { FetchAllOrdersUsecase } from "../../application/use-cases/fetch-all-orders.usecase";
import { FetchOrderByIdUsecase } from "../../application/use-cases/fetch-order-by-id.usecase";
import { FetchOrdersBySessionUsecase } from "../../application/use-cases/fetch-orders-by-session.usecase";
import { RemoveOrderItemUsecase } from "../../application/use-cases/remove-order-item.usecase";
import { SettleTableUsecase } from "../../application/use-cases/settle-table.usecase";
import { UpdateOrderStatusUsecase } from "../../application/use-cases/update-order-status.usecase";
import { ORDER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";

@Controller("restaurant/orders")
export class RestaurantOrderController {
  constructor(
    private readonly fetchAllOrdersUsecase: FetchAllOrdersUsecase,
    private readonly fetchOrderByIdUsecase: FetchOrderByIdUsecase,
    private readonly fetchOrdersBySessionUsecase: FetchOrdersBySessionUsecase,
    private readonly updateOrderStatusUsecase: UpdateOrderStatusUsecase,
    private readonly cancelOrderUsecase: CancelOrderUsecase,
    private readonly addOrderItemUsecase: AddOrderItemUsecase,
    private readonly removeOrderItemUsecase: RemoveOrderItemUsecase,
    private readonly settleTableUsecase: SettleTableUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async fetchAll(
    @Query() query: FetchOrdersDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IOrderWithItems>>> {
    const orders = await this.fetchAllOrdersUsecase.execute(query, authEntity);
    return buildHttpResponse(orders, ORDER_SUCCESS_MESSAGES.ORDERS_FETCHED);
  }

  /** Registered ahead of `/:id` — "session" would otherwise be swallowed as that route's uuid param. */
  @Get("/session/:sessionId")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async fetchBySession(
    @Param("sessionId", ParseUuidPipe) sessionId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems[]>> {
    const orders = await this.fetchOrdersBySessionUsecase.execute(sessionId, authEntity);
    return buildHttpResponse(orders, ORDER_SUCCESS_MESSAGES.ORDERS_FETCHED);
  }

  /** Registered ahead of `/:id` — "table" would otherwise be swallowed as that route's uuid param. */
  @Post("/table/:tableId/items")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async addItem(
    @Param("tableId", ParseUuidPipe) tableId: string,
    @Body() dto: AddOrderItemDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.addOrderItemUsecase.execute(tableId, dto, authEntity);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_ITEM_ADDED);
  }

  @Post("/table/:tableId/settle")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async settle(
    @Param("tableId", ParseUuidPipe) tableId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems[]>> {
    const orders = await this.settleTableUsecase.execute(tableId, authEntity);
    return buildHttpResponse(orders, ORDER_SUCCESS_MESSAGES.TABLE_SETTLED);
  }

  @Get("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async fetchById(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.fetchOrderByIdUsecase.execute(id, authEntity);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_FETCHED);
  }

  @Patch("/:id/status")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async updateStatus(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.updateOrderStatusUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_STATUS_UPDATED);
  }

  @Post("/:id/cancel")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:cancel"]]))
  async cancel(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: CancelOrderDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.cancelOrderUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_CANCELLED);
  }

  @Delete("/:orderId/items/:itemId")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async removeItem(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @Param("itemId", ParseUuidPipe) itemId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems>> {
    const order = await this.removeOrderItemUsecase.execute(orderId, itemId, authEntity);
    return buildHttpResponse(order, ORDER_SUCCESS_MESSAGES.ORDER_ITEM_REMOVED);
  }
}
