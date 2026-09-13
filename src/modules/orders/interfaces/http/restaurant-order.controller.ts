import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CancelOrderDto } from "../../application/dto/cancel-order.dto";
import { FetchOrdersDto } from "../../application/dto/fetch-orders.dto";
import { UpdateOrderStatusDto } from "../../application/dto/update-order-status.dto";
import { CancelOrderUsecase } from "../../application/use-cases/cancel-order.usecase";
import { FetchAllOrdersUsecase } from "../../application/use-cases/fetch-all-orders.usecase";
import { FetchOrderByIdUsecase } from "../../application/use-cases/fetch-order-by-id.usecase";
import { UpdateOrderStatusUsecase } from "../../application/use-cases/update-order-status.usecase";
import { ORDER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";

@Controller("restaurant/orders")
export class RestaurantOrderController {
  constructor(
    private readonly fetchAllOrdersUsecase: FetchAllOrdersUsecase,
    private readonly fetchOrderByIdUsecase: FetchOrderByIdUsecase,
    private readonly updateOrderStatusUsecase: UpdateOrderStatusUsecase,
    private readonly cancelOrderUsecase: CancelOrderUsecase
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
}
