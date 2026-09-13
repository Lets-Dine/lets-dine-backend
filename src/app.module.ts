import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { ZodValidationPipe } from "nestjs-zod";
import { DomainExceptionFilter } from "./common/exceptions/filters/domain-exception.filter";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { PrismaModule } from "./common/prisma";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DiningSessionsModule } from "./modules/dining-sessions/dining-sessions.module";
import { DishesModule } from "./modules/dishes/dishes.module";
import { MenuCategoriesModule } from "./modules/menu-categories/menu-categories.module";
import { MenusModule } from "./modules/menus/menus.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { RestaurantsModule } from "./modules/restaurants/restaurants.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { TablesModule } from "./modules/tables/tables.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "insecure-development-secret",
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? "12h") as JwtSignOptions["expiresIn"] },
    }),
    AuditLogsModule,
    UsersModule,
    AuthModule,
    RestaurantsModule,
    TablesModule,
    MenuCategoriesModule,
    DishesModule,
    MenusModule,
    DiningSessionsModule,
    OrdersModule,
    ReviewsModule,
    AnalyticsModule,
  ],
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
