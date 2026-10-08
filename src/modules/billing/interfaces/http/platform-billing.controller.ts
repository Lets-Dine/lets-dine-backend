import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { PlatformGuard } from "../../../../common/auth";
import { IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchPlatformTenantsDto } from "../../application/dto/fetch-platform-tenants.dto";
import { FetchPlatformTenantCountsUsecase } from "../../application/use-cases/fetch-platform-tenant-counts.usecase";
import { FetchPlatformTenantsUsecase } from "../../application/use-cases/fetch-platform-tenants.usecase";
import { UpdatePlansDto } from "../../application/dto/update-plans.dto";
import { AssignPlanDto } from "../../application/dto/assign-plan.dto";
import { FetchPlatformInvoicesDto } from "../../application/dto/fetch-platform-invoices.dto";
import { GenerateInvoicesDto } from "../../application/dto/generate-invoices.dto";
import { MarkInvoicePaidDto } from "../../application/dto/mark-invoice-paid.dto";
import { AssignPlanUsecase } from "../../application/use-cases/assign-plan.usecase";
import { FetchPlatformPlansUsecase } from "../../application/use-cases/fetch-platform-plans.usecase";
import { UpdatePlatformPlansUsecase } from "../../application/use-cases/update-platform-plans.usecase";
import { FetchPlatformInvoicesUsecase } from "../../application/use-cases/fetch-platform-invoices.usecase";
import { GenerateInvoicesUsecase, IGenerateInvoicesResult } from "../../application/use-cases/generate-invoices.usecase";
import { MarkInvoicePaidUsecase } from "../../application/use-cases/mark-invoice-paid.usecase";
import { IRunLifecycleResult, RunLifecycleUsecase } from "../../application/use-cases/run-lifecycle.usecase";
import { BILLING_SUCCESS_MESSAGES } from "../../domain/constants";
import { IInvoice, IPlatformPlans, ISubscriptionView, ITenantListItem, ITenantViewCounts } from "../../domain/interfaces/billing.interface";

/**
 * Operator-side billing, behind the platform key like restaurant onboarding. With
 * no scheduler yet, generating invoices and running the lifecycle are triggered
 * here — they are idempotent, so a scheduler can later call the same use cases.
 */
@Controller("platform/billing")
@UseGuards(PlatformGuard)
export class PlatformBillingController {
  constructor(
    private readonly fetchPlatformInvoicesUsecase: FetchPlatformInvoicesUsecase,
    private readonly generateInvoicesUsecase: GenerateInvoicesUsecase,
    private readonly markInvoicePaidUsecase: MarkInvoicePaidUsecase,
    private readonly runLifecycleUsecase: RunLifecycleUsecase,
    private readonly assignPlanUsecase: AssignPlanUsecase,
    private readonly fetchPlatformPlansUsecase: FetchPlatformPlansUsecase,
    private readonly updatePlatformPlansUsecase: UpdatePlatformPlansUsecase,
    private readonly fetchPlatformTenantsUsecase: FetchPlatformTenantsUsecase,
    private readonly fetchPlatformTenantCountsUsecase: FetchPlatformTenantCountsUsecase
  ) {}

  @Get("tenants")
  async fetchTenants(@Query() query: FetchPlatformTenantsDto): Promise<IHttpResponse<PaginatedResponse<ITenantListItem>>> {
    const tenants = await this.fetchPlatformTenantsUsecase.execute(query);
    return buildHttpResponse(tenants, BILLING_SUCCESS_MESSAGES.TENANTS_FETCHED);
  }

  @Get("tenants/counts")
  async fetchTenantCounts(): Promise<IHttpResponse<ITenantViewCounts>> {
    const counts = await this.fetchPlatformTenantCountsUsecase.execute();
    return buildHttpResponse(counts, BILLING_SUCCESS_MESSAGES.TENANT_COUNTS_FETCHED);
  }

  @Get("plans")
  async fetchPlans(): Promise<IHttpResponse<IPlatformPlans>> {
    const plans = await this.fetchPlatformPlansUsecase.execute();
    return buildHttpResponse(plans, BILLING_SUCCESS_MESSAGES.PLATFORM_PLANS_FETCHED);
  }

  @Put("plans")
  async updatePlans(@Body() dto: UpdatePlansDto): Promise<IHttpResponse<IPlatformPlans>> {
    const plans = await this.updatePlatformPlansUsecase.execute(dto);
    return buildHttpResponse(plans, BILLING_SUCCESS_MESSAGES.PLATFORM_PLANS_UPDATED);
  }

  @Get("invoices")
  async fetchInvoices(@Query() query: FetchPlatformInvoicesDto): Promise<IHttpResponse<PaginatedResponse<IInvoice>>> {
    const invoices = await this.fetchPlatformInvoicesUsecase.execute(query);
    return buildHttpResponse(invoices, BILLING_SUCCESS_MESSAGES.INVOICES_FETCHED);
  }

  @Post("invoices/generate")
  @HttpCode(HttpStatus.OK)
  async generateInvoices(@Body() dto: GenerateInvoicesDto): Promise<IHttpResponse<IGenerateInvoicesResult>> {
    const result = await this.generateInvoicesUsecase.execute(dto);
    return buildHttpResponse(result, BILLING_SUCCESS_MESSAGES.INVOICES_GENERATED);
  }

  @Post("restaurants/:restaurantId/invoices")
  async generateInvoiceForRestaurant(@Param("restaurantId", ParseUuidPipe) restaurantId: string): Promise<IHttpResponse<IInvoice>> {
    const invoice = await this.generateInvoicesUsecase.executeForRestaurant(restaurantId);
    return buildHttpResponse(invoice, BILLING_SUCCESS_MESSAGES.INVOICES_GENERATED);
  }

  @Post("invoices/:id/mark-paid")
  @HttpCode(HttpStatus.OK)
  async markInvoicePaid(@Param("id", ParseUuidPipe) id: string, @Body() dto: MarkInvoicePaidDto): Promise<IHttpResponse<IInvoice>> {
    const invoice = await this.markInvoicePaidUsecase.execute(id, dto);
    return buildHttpResponse(invoice, BILLING_SUCCESS_MESSAGES.INVOICE_PAID);
  }

  @Post("lifecycle/run")
  @HttpCode(HttpStatus.OK)
  async runLifecycle(): Promise<IHttpResponse<IRunLifecycleResult>> {
    const result = await this.runLifecycleUsecase.execute();
    return buildHttpResponse(result, BILLING_SUCCESS_MESSAGES.LIFECYCLE_RUN);
  }

  @Put("subscriptions/:restaurantId/plan")
  async assignPlan(
    @Param("restaurantId", ParseUuidPipe) restaurantId: string,
    @Body() dto: AssignPlanDto
  ): Promise<IHttpResponse<ISubscriptionView>> {
    const subscription = await this.assignPlanUsecase.execute(restaurantId, dto);
    return buildHttpResponse(subscription, BILLING_SUCCESS_MESSAGES.PLAN_ASSIGNED);
  }
}
