import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import {
  AssignDeliveryDto,
  CompleteDeliveryDto,
  CreatePartnerDto,
  CreateRiderDto,
  RecordSettlementDto,
  SettleDeliveryOrderDto,
  StatementQueryDto,
  UpdatePartnerDto,
  UpdateRiderDto,
} from "../../application/dto/delivery.dto";
import { AssignDeliveryUsecase } from "../../application/use-cases/assign-delivery.usecase";
import { CompleteDeliveryUsecase } from "../../application/use-cases/complete-delivery.usecase";
import { CreatePartnerUsecase } from "../../application/use-cases/create-partner.usecase";
import { CreateRiderUsecase } from "../../application/use-cases/create-rider.usecase";
import { GetCourierDetailUsecase } from "../../application/use-cases/get-courier-detail.usecase";
import { GetCourierStatementUsecase } from "../../application/use-cases/get-courier-statement.usecase";
import { GetDeliveryOverviewUsecase } from "../../application/use-cases/get-delivery-overview.usecase";
import { GetDispatchCouriersUsecase } from "../../application/use-cases/get-dispatch-couriers.usecase";
import { GetOrderAssignmentUsecase } from "../../application/use-cases/get-order-assignment.usecase";
import { SettleDeliveryOrderUsecase } from "../../application/use-cases/settle-delivery-order.usecase";
import { RecordSettlementUsecase } from "../../application/use-cases/record-settlement.usecase";
import { UpdatePartnerUsecase } from "../../application/use-cases/update-partner.usecase";
import { UpdateRiderUsecase } from "../../application/use-cases/update-rider.usecase";
import { IOrderWithItems } from "../../../orders/domain/interfaces/order.interface";
import { DELIVERY_SUCCESS_MESSAGES } from "../../domain/constants";
import {
  IDeliveryAssignment,
  IDeliveryBook,
  IDeliveryCourierDetail,
  IDeliveryOverview,
  IDeliveryPartner,
  IDeliveryRider,
  IDeliverySettlement,
  IStatementPage,
} from "../../domain/interfaces/delivery.interface";

const GUARDS = [AuthGuard, AbilityGuard] as const;

/**
 * Delivery couriers and what they owe each other, per branch (the branch comes from the token).
 * Staff who work the pass can dispatch and close runs; the books and the couriers' terms are the
 * manager's, like the cash book.
 */
@Controller("restaurant/delivery")
export class DeliveryController {
  constructor(
    private readonly getDeliveryOverviewUsecase: GetDeliveryOverviewUsecase,
    private readonly getCourierDetailUsecase: GetCourierDetailUsecase,
    private readonly getCourierStatementUsecase: GetCourierStatementUsecase,
    private readonly getDispatchCouriersUsecase: GetDispatchCouriersUsecase,
    private readonly createPartnerUsecase: CreatePartnerUsecase,
    private readonly updatePartnerUsecase: UpdatePartnerUsecase,
    private readonly createRiderUsecase: CreateRiderUsecase,
    private readonly updateRiderUsecase: UpdateRiderUsecase,
    private readonly getOrderAssignmentUsecase: GetOrderAssignmentUsecase,
    private readonly assignDeliveryUsecase: AssignDeliveryUsecase,
    private readonly completeDeliveryUsecase: CompleteDeliveryUsecase,
    private readonly settleDeliveryOrderUsecase: SettleDeliveryOrderUsecase,
    private readonly recordSettlementUsecase: RecordSettlementUsecase
  ) {}

  /** The listing: couriers with balances, no history. A courier's page reads its detail and statement apart. */
  @Get("book")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async book(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliveryOverview>> {
    return buildHttpResponse(await this.getDeliveryOverviewUsecase.execute(authEntity), DELIVERY_SUCCESS_MESSAGES.BOOK_FETCHED);
  }

  @Get("partners/:id")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async partner(
    @Param("id", ParseUuidPipe) id: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryCourierDetail>> {
    return buildHttpResponse(
      await this.getCourierDetailUsecase.execute("PARTNER", id, authEntity),
      DELIVERY_SUCCESS_MESSAGES.COURIER_FETCHED
    );
  }

  @Get("partners/:id/transactions")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async partnerTransactions(
    @Param("id", ParseUuidPipe) id: string,
    @Query() query: StatementQueryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IStatementPage>> {
    return buildHttpResponse(
      await this.getCourierStatementUsecase.execute("PARTNER", id, query, authEntity),
      DELIVERY_SUCCESS_MESSAGES.STATEMENT_FETCHED
    );
  }

  @Get("riders/:id")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async rider(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliveryCourierDetail>> {
    return buildHttpResponse(
      await this.getCourierDetailUsecase.execute("RIDER", id, authEntity),
      DELIVERY_SUCCESS_MESSAGES.COURIER_FETCHED
    );
  }

  @Get("riders/:id/transactions")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async riderTransactions(
    @Param("id", ParseUuidPipe) id: string,
    @Query() query: StatementQueryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IStatementPage>> {
    return buildHttpResponse(
      await this.getCourierStatementUsecase.execute("RIDER", id, query, authEntity),
      DELIVERY_SUCCESS_MESSAGES.STATEMENT_FETCHED
    );
  }

  @Get("couriers")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async couriers(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliveryBook>> {
    return buildHttpResponse(await this.getDispatchCouriersUsecase.execute(authEntity), DELIVERY_SUCCESS_MESSAGES.COURIERS_FETCHED);
  }

  @Post("partners")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async createPartner(@Body() dto: CreatePartnerDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliveryPartner>> {
    return buildHttpResponse(await this.createPartnerUsecase.execute(dto, authEntity), DELIVERY_SUCCESS_MESSAGES.PARTNER_CREATED);
  }

  @Patch("partners/:id")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async updatePartner(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdatePartnerDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryPartner>> {
    return buildHttpResponse(await this.updatePartnerUsecase.execute(id, dto, authEntity), DELIVERY_SUCCESS_MESSAGES.PARTNER_UPDATED);
  }

  @Post("riders")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async createRider(@Body() dto: CreateRiderDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliveryRider>> {
    return buildHttpResponse(await this.createRiderUsecase.execute(dto, authEntity), DELIVERY_SUCCESS_MESSAGES.RIDER_CREATED);
  }

  @Patch("riders/:id")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async updateRider(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateRiderDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryRider>> {
    return buildHttpResponse(await this.updateRiderUsecase.execute(id, dto, authEntity), DELIVERY_SUCCESS_MESSAGES.RIDER_UPDATED);
  }

  @Get("orders/:orderId/assignment")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async assignment(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryAssignment | null>> {
    return buildHttpResponse(
      await this.getOrderAssignmentUsecase.execute(orderId, authEntity),
      DELIVERY_SUCCESS_MESSAGES.ASSIGNMENT_FETCHED
    );
  }

  @Post("orders/:orderId/assign")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async assign(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @Body() dto: AssignDeliveryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryAssignment>> {
    return buildHttpResponse(await this.assignDeliveryUsecase.execute(orderId, dto, authEntity), DELIVERY_SUCCESS_MESSAGES.ASSIGNED);
  }

  @Post("orders/:orderId/complete")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async complete(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @Body() dto: CompleteDeliveryDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IDeliveryAssignment | null>> {
    return buildHttpResponse(await this.completeDeliveryUsecase.execute(orderId, dto, authEntity), DELIVERY_SUCCESS_MESSAGES.COMPLETED);
  }

  @Post("orders/:orderId/settle")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async settleOrder(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @Body() dto: SettleDeliveryOrderDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderWithItems>> {
    return buildHttpResponse(
      await this.settleDeliveryOrderUsecase.execute(orderId, dto, authEntity),
      DELIVERY_SUCCESS_MESSAGES.ORDER_SETTLED
    );
  }

  @Post("settlements")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async settle(@Body() dto: RecordSettlementDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDeliverySettlement>> {
    return buildHttpResponse(await this.recordSettlementUsecase.execute(dto, authEntity), DELIVERY_SUCCESS_MESSAGES.SETTLED);
  }
}
