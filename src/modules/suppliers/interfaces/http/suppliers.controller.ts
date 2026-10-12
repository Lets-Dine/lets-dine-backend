import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateSupplierDto, FetchSupplierPageDto, LogIssueDto, RecordPaymentDto, UpdateSupplierDto } from "../../application/dto/suppliers.dto";
import { CreateSupplierUsecase } from "../../application/use-cases/create-supplier.usecase";
import { FetchSupplierDetailUsecase } from "../../application/use-cases/fetch-supplier-detail.usecase";
import { FetchSupplierDeliveriesUsecase } from "../../application/use-cases/fetch-supplier-deliveries.usecase";
import { FetchSupplierPricesUsecase } from "../../application/use-cases/fetch-supplier-prices.usecase";
import { LogSupplierIssueUsecase } from "../../application/use-cases/log-supplier-issue.usecase";
import { RecordSupplierPaymentUsecase } from "../../application/use-cases/record-supplier-payment.usecase";
import { ListSuppliersUsecase } from "../../application/use-cases/list-suppliers.usecase";
import { UpdateSupplierUsecase } from "../../application/use-cases/update-supplier.usecase";
import { SUPPLIERS_SUCCESS_MESSAGES } from "../../domain/constants";
import { IDelivery, IIngredientPrice, IIssue, IPage, IPayment, ISupplierDetail, ISupplierListItem, ISupplierRecord } from "../../domain/interfaces/suppliers.interface";

const VIEW = [AuthGuard, AbilityGuard] as const;

@Controller("restaurant/suppliers")
export class SuppliersController {
  constructor(
    private readonly listSuppliersUsecase: ListSuppliersUsecase,
    private readonly fetchSupplierDetailUsecase: FetchSupplierDetailUsecase,
    private readonly createSupplierUsecase: CreateSupplierUsecase,
    private readonly updateSupplierUsecase: UpdateSupplierUsecase,
    private readonly recordSupplierPaymentUsecase: RecordSupplierPaymentUsecase,
    private readonly logSupplierIssueUsecase: LogSupplierIssueUsecase,
    private readonly fetchSupplierDeliveriesUsecase: FetchSupplierDeliveriesUsecase,
    private readonly fetchSupplierPricesUsecase: FetchSupplierPricesUsecase
  ) {}

  @Get()
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async list(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ISupplierListItem[]>> {
    return buildHttpResponse(await this.listSuppliersUsecase.execute(authEntity), SUPPLIERS_SUCCESS_MESSAGES.FETCHED);
  }

  /** By name rather than id, so a supplier that only exists on old deliveries has a page too. */
  @Get("detail")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async detail(@Query("name") name: unknown, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ISupplierDetail>> {
    return buildHttpResponse(await this.fetchSupplierDetailUsecase.execute(typeof name === "string" ? name.trim() : "", authEntity), SUPPLIERS_SUCCESS_MESSAGES.DETAIL_FETCHED);
  }

  @Get("deliveries")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async deliveries(@Query() query: FetchSupplierPageDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPage<IDelivery>>> {
    return buildHttpResponse(await this.fetchSupplierDeliveriesUsecase.execute(query, authEntity), SUPPLIERS_SUCCESS_MESSAGES.DETAIL_FETCHED);
  }

  @Get("prices")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:view"]]))
  async prices(@Query() query: FetchSupplierPageDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPage<IIngredientPrice>>> {
    return buildHttpResponse(await this.fetchSupplierPricesUsecase.execute(query, authEntity), SUPPLIERS_SUCCESS_MESSAGES.DETAIL_FETCHED);
  }

  @Post()
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async create(@Body() dto: CreateSupplierDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ISupplierRecord>> {
    return buildHttpResponse(await this.createSupplierUsecase.execute(dto, authEntity), SUPPLIERS_SUCCESS_MESSAGES.CREATED);
  }

  @Post("payments")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async pay(@Body() dto: RecordPaymentDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPayment>> {
    return buildHttpResponse(await this.recordSupplierPaymentUsecase.execute(dto, authEntity), SUPPLIERS_SUCCESS_MESSAGES.PAYMENT_RECORDED);
  }

  @Post("issues")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async issue(@Body() dto: LogIssueDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IIssue>> {
    return buildHttpResponse(await this.logSupplierIssueUsecase.execute(dto, authEntity), SUPPLIERS_SUCCESS_MESSAGES.ISSUE_LOGGED);
  }

  @Patch(":id")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["inventory:manage"]]))
  async update(@Param("id") id: string, @Body() dto: UpdateSupplierDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ISupplierRecord>> {
    return buildHttpResponse(await this.updateSupplierUsecase.execute(id, dto, authEntity), SUPPLIERS_SUCCESS_MESSAGES.UPDATED);
  }
}
