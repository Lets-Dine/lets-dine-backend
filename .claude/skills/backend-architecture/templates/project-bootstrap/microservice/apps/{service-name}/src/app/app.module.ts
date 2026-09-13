import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { RequestLoggerMiddleware } from "{scope}/core/middleware";
import { ZodValidationPipe } from "nestjs-zod";
import { DomainExceptionFilter } from "{scope}/core/exceptions";

@Module({
  imports: [
    // register this service's feature modules here as they're scaffolded, e.g. FeatureModule
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
