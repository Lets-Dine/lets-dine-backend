import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { DishesModule } from "../dishes/dishes.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { CompletePaymentUsecase } from "./application/use-cases/complete-payment.usecase";
import { PaymentRepository } from "./domain/repositories/payment.repository";
import PaymentRepositoryImpl from "./infrastructure/repositories/payment.repository.impl";
import { PaymentController } from "./interfaces/http/payment.controller";

@Module({
  imports: [DiningSessionsModule, DishesModule, RestaurantsModule, AuditLogsModule],
  controllers: [PaymentController],
  providers: [CompletePaymentUsecase, PaymentRepositoryImpl, { provide: PaymentRepository, useExisting: PaymentRepositoryImpl }],
  exports: [{ provide: PaymentRepository, useExisting: PaymentRepositoryImpl }],
})
export class PaymentsModule {}
