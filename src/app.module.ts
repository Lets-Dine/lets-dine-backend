import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { ZodValidationPipe } from "nestjs-zod";
import { DomainExceptionFilter } from "./common/exceptions/filters/domain-exception.filter";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { PrismaModule } from "./common/prisma";
import { AddOnsModule } from "./modules/add-ons/add-ons.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DiningSessionsModule } from "./modules/dining-sessions/dining-sessions.module";
import { DishPhotosModule } from "./modules/dish-photos/dish-photos.module";
import { DishesModule } from "./modules/dishes/dishes.module";
import { DishVariantsModule } from "./modules/dish-variants/dish-variants.module";
import { BillingModule } from "./modules/billing/billing.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { FloorsModule } from "./modules/floors/floors.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { MenuCategoriesModule } from "./modules/menu-categories/menu-categories.module";
import { MenusModule } from "./modules/menus/menus.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { RestaurantsModule } from "./modules/restaurants/restaurants.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { TablesModule } from "./modules/tables/tables.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/users.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "insecure-development-secret",
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as JwtSignOptions["expiresIn"] },
    }),
    AuditLogsModule,
    UsersModule,
    AuthModule,
    RestaurantsModule,
    BillingModule,
    TablesModule,
    BranchesModule,
    FloorsModule,
    MenuCategoriesModule,
    DishesModule,
    DishVariantsModule,
    AddOnsModule,
    MenusModule,
    DiningSessionsModule,
    OrdersModule,
    PaymentsModule,
    LedgerModule,
    InventoryModule,
    FeedbackModule,
    ReviewsModule,
    AnalyticsModule,
    UploadsModule,
    DishPhotosModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // LOG_HTTP_REQUESTS=false silences it — see PrismaService for the matching Prisma-query toggle.
    if (process.env.LOG_HTTP_REQUESTS !== "false") {
      consumer.apply(RequestLoggerMiddleware).forRoutes("*");
    }
  }
}
