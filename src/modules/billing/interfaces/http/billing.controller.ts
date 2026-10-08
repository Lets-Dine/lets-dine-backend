import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AllowWhenSuspended, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { EsewaCheckoutService, IEsewaCheckout } from "../../application/esewa-checkout.service";
import { ChangePlanDto } from "../../application/dto/change-plan.dto";
import { ConfirmEsewaDto } from "../../application/dto/confirm-esewa.dto";
import { FetchInvoicesDto } from "../../application/dto/fetch-invoices.dto";
import { ChangePlanUsecase, IChangePlanResult } from "../../application/use-cases/change-plan.usecase";
import { FetchInvoicesUsecase } from "../../application/use-cases/fetch-invoices.usecase";
import { FetchPlansUsecase } from "../../application/use-cases/fetch-plans.usecase";
import { FetchSubscriptionUsecase } from "../../application/use-cases/fetch-subscription.usecase";
import { FetchUsageUsecase } from "../../application/use-cases/fetch-usage.usecase";
import { BILLING_SUCCESS_MESSAGES } from "../../domain/constants";
import { IInvoice, IPlanView, ISubscriptionView, IUsage } from "../../domain/interfaces/billing.interface";

/**
 * A restaurant's view of its own plan. Status and usage (`billing:view`) are open to managers
 * too, so they know what the restaurant is on and when it needs attention; plans, prices,
 * invoices and changing plan (`billing:manage`) are the owner's. Deliberately not behind
 * SubscriptionActiveGuard: a restricted restaurant must still be able to see what
 * it owes and change plan, or it could never get itself unstuck. The same goes for
 * suspension: this is the one part of the app an owner can still reach then, to pay.
 */
@AllowWhenSuspended()
@Controller("restaurant/billing")
export class BillingController {
  constructor(
    private readonly fetchSubscriptionUsecase: FetchSubscriptionUsecase,
    private readonly fetchUsageUsecase: FetchUsageUsecase,
    private readonly fetchPlansUsecase: FetchPlansUsecase,
    private readonly fetchInvoicesUsecase: FetchInvoicesUsecase,
    private readonly changePlanUsecase: ChangePlanUsecase,
    private readonly esewaCheckoutService: EsewaCheckoutService
  ) {}

  @Get("subscription")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:view"]]))
  async fetchSubscription(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ISubscriptionView>> {
    const subscription = await this.fetchSubscriptionUsecase.execute(authEntity);
    return buildHttpResponse(subscription, BILLING_SUCCESS_MESSAGES.SUBSCRIPTION_FETCHED);
  }

  @Get("usage")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:view"]]))
  async fetchUsage(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IUsage>> {
    const usage = await this.fetchUsageUsecase.execute(authEntity);
    return buildHttpResponse(usage, BILLING_SUCCESS_MESSAGES.USAGE_FETCHED);
  }

  @Get("plans")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:manage"]]))
  async fetchPlans(): Promise<IHttpResponse<IPlanView[]>> {
    const plans = await this.fetchPlansUsecase.execute();
    return buildHttpResponse(plans, BILLING_SUCCESS_MESSAGES.PLANS_FETCHED);
  }

  @Get("invoices")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:manage"]]))
  async fetchInvoices(
    @Query() query: FetchInvoicesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IInvoice>>> {
    const invoices = await this.fetchInvoicesUsecase.execute(query, authEntity);
    return buildHttpResponse(invoices, BILLING_SUCCESS_MESSAGES.INVOICES_FETCHED);
  }

  @Post("change-plan")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:manage"]]))
  async changePlan(@Body() dto: ChangePlanDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IChangePlanResult>> {
    const result = await this.changePlanUsecase.execute(dto, authEntity);
    return buildHttpResponse(result, BILLING_SUCCESS_MESSAGES.PLAN_CHANGED);
  }

  @Post("invoices/:id/esewa")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:manage"]]))
  async startEsewa(@Param("id", ParseUUIDPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IEsewaCheckout>> {
    const checkout = await this.esewaCheckoutService.start(id, authEntity.restaurantId);
    return buildHttpResponse(checkout, BILLING_SUCCESS_MESSAGES.ESEWA_STARTED);
  }

  @Post("esewa/verify")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["billing:manage"]]))
  async confirmEsewa(@Body() dto: ConfirmEsewaDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IInvoice>> {
    const invoice = await this.esewaCheckoutService.confirm(dto.data, authEntity.restaurantId);
    return buildHttpResponse(invoice, BILLING_SUCCESS_MESSAGES.INVOICE_PAID);
  }
}
