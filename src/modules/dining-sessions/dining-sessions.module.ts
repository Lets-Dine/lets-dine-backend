import { Module } from "@nestjs/common";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { TablesModule } from "../tables/tables.module";
import { DiningSessionService } from "./application/dining-session.service";
import { FetchCurrentSessionUsecase } from "./application/use-cases/fetch-current-session.usecase";
import { StartDiningSessionUsecase } from "./application/use-cases/start-dining-session.usecase";
import { DiningSessionRepository } from "./domain/repositories/dining-session.repository";
import DiningSessionRepositoryImpl from "./infrastructure/repositories/dining-session.repository.impl";
import { DiningSessionController } from "./interfaces/http/dining-session.controller";
import { DinerSessionGuard } from "./interfaces/http/guards/diner-session.guard";

@Module({
  imports: [RestaurantsModule, TablesModule],
  controllers: [DiningSessionController],
  providers: [
    DiningSessionService,
    DinerSessionGuard,
    StartDiningSessionUsecase,
    FetchCurrentSessionUsecase,
    DiningSessionRepositoryImpl,
    { provide: DiningSessionRepository, useExisting: DiningSessionRepositoryImpl },
  ],
  exports: [DiningSessionService, DinerSessionGuard, { provide: DiningSessionRepository, useExisting: DiningSessionRepositoryImpl }],
})
export class DiningSessionsModule {}
