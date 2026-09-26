import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchAnalyticsDto } from "../../application/dto/fetch-analytics.dto";
import { FetchOrderComparisonDto } from "../../application/dto/fetch-order-comparison.dto";
import { FetchRevenueComparisonDto } from "../../application/dto/fetch-revenue-comparison.dto";
import { FetchAnalyticsOverviewUsecase } from "../../application/use-cases/fetch-analytics-overview.usecase";
import { FetchOrderComparisonUsecase } from "../../application/use-cases/fetch-order-comparison.usecase";
import { FetchRevenueComparisonUsecase } from "../../application/use-cases/fetch-revenue-comparison.usecase";
import { ANALYTICS_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAnalyticsOverview, IOrderComparison, IRevenueComparison } from "../../domain/interfaces/analytics.interface";

@Controller("restaurant/analytics")
export class AnalyticsController {
  constructor(
    private readonly fetchAnalyticsOverviewUsecase: FetchAnalyticsOverviewUsecase,
    private readonly fetchRevenueComparisonUsecase: FetchRevenueComparisonUsecase,
    private readonly fetchOrderComparisonUsecase: FetchOrderComparisonUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchOverview(@Query() query: FetchAnalyticsDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAnalyticsOverview>> {
    const overview = await this.fetchAnalyticsOverviewUsecase.execute(query, authEntity);
    return buildHttpResponse(overview, ANALYTICS_SUCCESS_MESSAGES.ANALYTICS_FETCHED);
  }

  @Get("revenue")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchRevenueComparison(
    @Query() query: FetchRevenueComparisonDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IRevenueComparison>> {
    const comparison = await this.fetchRevenueComparisonUsecase.execute(query.period, authEntity);
    return buildHttpResponse(comparison, ANALYTICS_SUCCESS_MESSAGES.REVENUE_COMPARISON_FETCHED);
  }

  @Get("orders")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchOrderComparison(
    @Query() query: FetchOrderComparisonDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderComparison>> {
    const comparison = await this.fetchOrderComparisonUsecase.execute(query.period, authEntity);
    return buildHttpResponse(comparison, ANALYTICS_SUCCESS_MESSAGES.ORDER_COMPARISON_FETCHED);
  }
}
