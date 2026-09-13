import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchAnalyticsDto } from "../../application/dto/fetch-analytics.dto";
import { FetchAnalyticsOverviewUsecase } from "../../application/use-cases/fetch-analytics-overview.usecase";
import { ANALYTICS_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAnalyticsOverview } from "../../domain/interfaces/analytics.interface";

@Controller("restaurant/analytics")
export class AnalyticsController {
  constructor(private readonly fetchAnalyticsOverviewUsecase: FetchAnalyticsOverviewUsecase) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["analytics:view"]]))
  async fetchOverview(@Query() query: FetchAnalyticsDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IAnalyticsOverview>> {
    const overview = await this.fetchAnalyticsOverviewUsecase.execute(query, authEntity);
    return buildHttpResponse(overview, ANALYTICS_SUCCESS_MESSAGES.ANALYTICS_FETCHED);
  }
}
