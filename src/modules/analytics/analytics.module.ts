import { Module } from "@nestjs/common";
import { FetchAnalyticsOverviewUsecase } from "./application/use-cases/fetch-analytics-overview.usecase";
import { AnalyticsRepository } from "./domain/repositories/analytics.repository";
import AnalyticsRepositoryImpl from "./infrastructure/repositories/analytics.repository.impl";
import { AnalyticsController } from "./interfaces/http/analytics.controller";

@Module({
  controllers: [AnalyticsController],
  providers: [
    FetchAnalyticsOverviewUsecase,
    AnalyticsRepositoryImpl,
    { provide: AnalyticsRepository, useExisting: AnalyticsRepositoryImpl },
  ],
  exports: [{ provide: AnalyticsRepository, useExisting: AnalyticsRepositoryImpl }],
})
export class AnalyticsModule {}
