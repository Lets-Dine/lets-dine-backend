import { Module } from "@nestjs/common";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { FetchAnalyticsOverviewUsecase } from "./application/use-cases/fetch-analytics-overview.usecase";
import { FetchOrderComparisonUsecase } from "./application/use-cases/fetch-order-comparison.usecase";
import { FetchRevenueComparisonUsecase } from "./application/use-cases/fetch-revenue-comparison.usecase";
import { AnalyticsRepository } from "./domain/repositories/analytics.repository";
import AnalyticsRepositoryImpl from "./infrastructure/repositories/analytics.repository.impl";
import { AnalyticsController } from "./interfaces/http/analytics.controller";

@Module({
  imports: [RestaurantsModule],
  controllers: [AnalyticsController],
  providers: [
    FetchAnalyticsOverviewUsecase,
    FetchRevenueComparisonUsecase,
    FetchOrderComparisonUsecase,
    AnalyticsRepositoryImpl,
    { provide: AnalyticsRepository, useExisting: AnalyticsRepositoryImpl },
  ],
  exports: [{ provide: AnalyticsRepository, useExisting: AnalyticsRepositoryImpl }],
})
export class AnalyticsModule {}
