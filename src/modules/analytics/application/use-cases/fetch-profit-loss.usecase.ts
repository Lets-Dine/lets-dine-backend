import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { IProfitLoss } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { resolveAnalyticsScope } from "../../domain/utils/resolve-analytics-scope.util";
import { FetchProfitLossQuery } from "../../interfaces/http/validations/fetch-profit-loss.validation";
import { ANALYTICS_ERROR_MESSAGES } from "./fetch-analytics-overview.usecase";

/**
 * Revenue (sales net of tax, less refunds) − cost of food = gross profit; less operating spend = net profit.
 * Cost of food is what left the shelves: opening stock + purchases − stock sent away − closing stock. That
 * takes in waste, staff meals, manual use and shrinkage without having to catch each one, and is only as
 * good as the stock counts — a count at the end of the period keeps it honest.
 */
@Injectable()
export class FetchProfitLossUsecase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  async execute(query: FetchProfitLossQuery, authEntity: AuthEntity): Promise<IProfitLoss> {
    await this.entitlementService.assertFeature(authEntity.restaurantId, "analyticsFull");
    if (query.from.getTime() >= query.to.getTime()) throw new BadRequestException(ANALYTICS_ERROR_MESSAGES.INVALID_RANGE);

    const range = { from: query.from, to: query.to };
    const figures = await this.analyticsRepository.fetchProfitLossFigures(resolveAnalyticsScope(authEntity, query.branchId), range);

    const revenue = figures.sales - figures.refunds;
    const cogs = figures.stockOpening + figures.stockPurchases - figures.stockOut - figures.stockClosing;
    const grossProfit = revenue - cogs;
    const operatingExpenses = figures.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - operatingExpenses;

    return {
      ...figures,
      range,
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      netMargin: revenue > 0 ? netProfit / revenue : null,
    };
  }
}
