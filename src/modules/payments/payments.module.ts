import { Module } from "@nestjs/common";
import { AddOnsModule } from "../add-ons/add-ons.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BranchesModule } from "../branches/branches.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { DishesModule } from "../dishes/dishes.module";
import { DishVariantsModule } from "../dish-variants/dish-variants.module";
import { OrdersModule } from "../orders/orders.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { CompletePaymentUsecase } from "./application/use-cases/complete-payment.usecase";
import { FetchSessionPaymentUsecase } from "./application/use-cases/fetch-session-payment.usecase";
import { GetPaymentUsecase } from "./application/use-cases/get-payment.usecase";
import { ListPaymentsUsecase } from "./application/use-cases/list-payments.usecase";
import { FonepayService } from "./infrastructure/fonepay/fonepay.service";
import { PaymentRepository } from "./domain/repositories/payment.repository";
import PaymentRepositoryImpl from "./infrastructure/repositories/payment.repository.impl";
import { FonepayController } from "./interfaces/http/fonepay.controller";
import { PaymentController } from "./interfaces/http/payment.controller";
import { PublicPaymentController } from "./interfaces/http/public-payment.controller";

@Module({
  imports: [
    AddOnsModule,
    BranchesModule,
    DiningSessionsModule,
    DishesModule,
    DishVariantsModule,
    OrdersModule,
    RestaurantsModule,
    AuditLogsModule,
  ],
  controllers: [FonepayController, PaymentController, PublicPaymentController],
  providers: [
    CompletePaymentUsecase,
    ListPaymentsUsecase,
    GetPaymentUsecase,
    FetchSessionPaymentUsecase,
    FonepayService,
    PaymentRepositoryImpl,
    { provide: PaymentRepository, useExisting: PaymentRepositoryImpl },
  ],
  exports: [FonepayService, { provide: PaymentRepository, useExisting: PaymentRepositoryImpl }],
})
export class PaymentsModule {}
