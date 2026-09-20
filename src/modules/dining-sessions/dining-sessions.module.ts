import { forwardRef, Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { OrdersModule } from "../orders/orders.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { TablesModule } from "../tables/tables.module";
import { DiningSessionService } from "./application/dining-session.service";
import { EndDiningSessionUsecase } from "./application/use-cases/end-dining-session.usecase";
import { FetchActiveSessionForTableUsecase } from "./application/use-cases/fetch-active-session-for-table.usecase";
import { FetchCurrentSessionUsecase } from "./application/use-cases/fetch-current-session.usecase";
import { StartDiningSessionUsecase } from "./application/use-cases/start-dining-session.usecase";
import { DiningSessionRepository } from "./domain/repositories/dining-session.repository";
import DiningSessionRepositoryImpl from "./infrastructure/repositories/dining-session.repository.impl";
import { DiningSessionController } from "./interfaces/http/dining-session.controller";
import { DinerSessionGuard } from "./interfaces/http/guards/diner-session.guard";
import { RestaurantDiningSessionController } from "./interfaces/http/restaurant-dining-session.controller";

@Module({
  // `EndDiningSessionService` needs `OrderRepository` to close out a session's orders, and
  // `OrdersModule` needs `DiningSessionRepository` for order creation — a genuine cycle between
  // the two domains, broken with `forwardRef` on both sides (see `OrdersModule`'s own imports).
  imports: [RestaurantsModule, TablesModule, AuditLogsModule, forwardRef(() => OrdersModule)],
  controllers: [DiningSessionController, RestaurantDiningSessionController],
  providers: [
    DiningSessionService,
    DinerSessionGuard,
    StartDiningSessionUsecase,
    FetchCurrentSessionUsecase,
    EndDiningSessionUsecase,
    DiningSessionRepositoryImpl,
    { provide: DiningSessionRepository, useExisting: DiningSessionRepositoryImpl },
  ],
  exports: [
    DiningSessionService,
    DinerSessionGuard,
    { provide: DiningSessionRepository, useExisting: DiningSessionRepositoryImpl },
  ],
})
export class DiningSessionsModule {}
