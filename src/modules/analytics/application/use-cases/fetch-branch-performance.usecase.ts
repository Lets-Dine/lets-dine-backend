import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { IBranchPerformance } from "../../domain/interfaces/analytics.interface";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { resolveAnalyticsScope } from "../../domain/utils/resolve-analytics-scope.util";
import { FetchBranchPerformanceQuery } from "../../interfaces/http/validations/fetch-branch-performance.validation";
import { ANALYTICS_ERROR_MESSAGES } from "./fetch-analytics-overview.usecase";

const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The cross-branch comparison: one row per branch the caller may see, so an owner can rank their locations. */
@Injectable()
export class FetchBranchPerformanceUsecase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  async execute(query: FetchBranchPerformanceQuery, authEntity: AuthEntity): Promise<IBranchPerformance[]> {
    await this.entitlementService.assertFeature(authEntity.restaurantId, "analyticsFull");

    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    if (from.getTime() > to.getTime()) throw new BadRequestException(ANALYTICS_ERROR_MESSAGES.INVALID_RANGE);

    return this.analyticsRepository.fetchBranchPerformance(resolveAnalyticsScope(authEntity), { from, to });
  }
}
