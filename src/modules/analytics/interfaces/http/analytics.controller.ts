import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchAnalyticsDto } from "../../application/dto/fetch-analytics.dto";
import { FetchBranchPerformanceDto } from "../../application/dto/fetch-branch-performance.dto";
import { FetchOrderComparisonDto } from "../../application/dto/fetch-order-comparison.dto";
import { FetchProfitLossDto } from "../../application/dto/fetch-profit-loss.dto";
import { FetchRevenueComparisonDto } from "../../application/dto/fetch-revenue-comparison.dto";
import { FetchRevenueTrendDto } from "../../application/dto/fetch-revenue-trend.dto";
import { FetchTopSellingDishesDto } from "../../application/dto/fetch-top-selling-dishes.dto";
import { FetchAnalyticsOverviewUsecase } from "../../application/use-cases/fetch-analytics-overview.usecase";
import { FetchBranchPerformanceUsecase } from "../../application/use-cases/fetch-branch-performance.usecase";
import { FetchOrderComparisonUsecase } from "../../application/use-cases/fetch-order-comparison.usecase";
import { FetchProfitLossUsecase } from "../../application/use-cases/fetch-profit-loss.usecase";
import { FetchRevenueComparisonUsecase } from "../../application/use-cases/fetch-revenue-comparison.usecase";
import { FetchRevenueTrendUsecase } from "../../application/use-cases/fetch-revenue-trend.usecase";
import { FetchTopSellingDishesUsecase } from "../../application/use-cases/fetch-top-selling-dishes.usecase";
import { ANALYTICS_SUCCESS_MESSAGES } from "../../domain/constants";
import {
  IAnalyticsOverview,
  IBranchPerformance,
  IOrderComparison,
  IProfitLoss,
  IRevenueComparison,
  IRevenueTrend,
  ITopSellingDishTrend,
} from "../../domain/interfaces/analytics.interface";

@Controller("restaurant/analytics")
export class AnalyticsController {
  constructor(
    private readonly fetchAnalyticsOverviewUsecase: FetchAnalyticsOverviewUsecase,
    private readonly fetchRevenueComparisonUsecase: FetchRevenueComparisonUsecase,
    private readonly fetchRevenueTrendUsecase: FetchRevenueTrendUsecase,
    private readonly fetchOrderComparisonUsecase: FetchOrderComparisonUsecase,
    private readonly fetchTopSellingDishesUsecase: FetchTopSellingDishesUsecase,
    private readonly fetchBranchPerformanceUsecase: FetchBranchPerformanceUsecase,
    private readonly fetchProfitLossUsecase: FetchProfitLossUsecase
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
    const comparison = await this.fetchRevenueComparisonUsecase.execute(query.period, authEntity, query.branchId);
    return buildHttpResponse(comparison, ANALYTICS_SUCCESS_MESSAGES.REVENUE_COMPARISON_FETCHED);
  }

  @Get("revenue/trend")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchRevenueTrend(@Query() query: FetchRevenueTrendDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRevenueTrend>> {
    const trend = await this.fetchRevenueTrendUsecase.execute(query.period, authEntity, query.branchId);
    return buildHttpResponse(trend, ANALYTICS_SUCCESS_MESSAGES.REVENUE_TREND_FETCHED);
  }

  @Get("orders")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchOrderComparison(
    @Query() query: FetchOrderComparisonDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IOrderComparison>> {
    const comparison = await this.fetchOrderComparisonUsecase.execute(query.period, authEntity, query.branchId);
    return buildHttpResponse(comparison, ANALYTICS_SUCCESS_MESSAGES.ORDER_COMPARISON_FETCHED);
  }

  @Get("branches")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchBranchPerformance(
    @Query() query: FetchBranchPerformanceDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IBranchPerformance[]>> {
    const branches = await this.fetchBranchPerformanceUsecase.execute(query, authEntity);
    return buildHttpResponse(branches, ANALYTICS_SUCCESS_MESSAGES.BRANCH_PERFORMANCE_FETCHED);
  }

  @Get("top-dishes")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchTopSellingDishes(
    @Query() query: FetchTopSellingDishesDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<ITopSellingDishTrend[]>> {
    const dishes = await this.fetchTopSellingDishesUsecase.execute(query, authEntity);
    return buildHttpResponse(dishes, ANALYTICS_SUCCESS_MESSAGES.TOP_SELLING_DISHES_FETCHED);
  }

  @Get("profit-loss")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchProfitLoss(@Query() query: FetchProfitLossDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IProfitLoss>> {
    const statement = await this.fetchProfitLossUsecase.execute(query, authEntity);
    return buildHttpResponse(statement, ANALYTICS_SUCCESS_MESSAGES.PROFIT_LOSS_FETCHED);
  }
}
