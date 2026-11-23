import { Module } from "@nestjs/common";
import { AddOnsModule } from "../add-ons/add-ons.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { BranchesModule } from "../branches/branches.module";
import { CustomersModule } from "../customers/customers.module";
import { DiningSessionsModule } from "../dining-sessions/dining-sessions.module";
import { DishesModule } from "../dishes/dishes.module";
import { DishVariantsModule } from "../dish-variants/dish-variants.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { OrdersModule } from "../orders/orders.module";
import { UsersModule } from "../users/users.module";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { ApprovalAttemptLimiter, PaymentApprovalService } from "./application/payment-approval.service";
import { ListPaymentApproversUsecase } from "./application/use-cases/list-payment-approvers.usecase";
import { CollectPaymentUsecase } from "./application/use-cases/collect-payment.usecase";
import { RefundPaymentUsecase } from "./application/use-cases/refund-payment.usecase";
import { CompletePaymentUsecase } from "./application/use-cases/complete-payment.usecase";
import { FetchBilledItemsUsecase } from "./application/use-cases/fetch-billed-items.usecase";
import { FetchSessionPaymentUsecase } from "./application/use-cases/fetch-session-payment.usecase";
import { GetPaymentUsecase, RecordPaymentPrintUsecase } from "./application/use-cases/get-payment.usecase";
import { PaymentRegisterUsecase, SummarizePaymentsUsecase } from "./application/use-cases/summarize-payments.usecase";
import { ListPaymentsUsecase } from "./application/use-cases/list-payments.usecase";
import { FonepayService } from "./infrastructure/fonepay/fonepay.service";
import { PaymentRepository } from "./domain/repositories/payment.repository";
import PaymentRepositoryImpl from "./infrastructure/repositories/payment.repository.impl";
import { FonepayController } from "./interfaces/http/fonepay.controller";
import { StaticQrController } from "./interfaces/http/static-qr.controller";
import { StaticQrService } from "./infrastructure/static-qr.service";
import { PaymentController } from "./interfaces/http/payment.controller";
import { PublicPaymentController } from "./interfaces/http/public-payment.controller";

@Module({
  imports: [
    AddOnsModule,
    BranchesModule,
    CustomersModule,
    DiningSessionsModule,
    DishesModule,
    DishVariantsModule,
    LoyaltyModule,
    OrdersModule,
    RestaurantsModule,
    AuditLogsModule,
    UsersModule,
  ],
  controllers: [FonepayController, StaticQrController, PaymentController, PublicPaymentController],
  providers: [
    CompletePaymentUsecase,
    ListPaymentApproversUsecase,
    PaymentApprovalService,
    ApprovalAttemptLimiter,
    CollectPaymentUsecase,
    RefundPaymentUsecase,
    ListPaymentsUsecase,
    SummarizePaymentsUsecase,
    PaymentRegisterUsecase,
    GetPaymentUsecase,
    RecordPaymentPrintUsecase,
    FetchSessionPaymentUsecase,
    FetchBilledItemsUsecase,
    FonepayService,
    StaticQrService,
    PaymentRepositoryImpl,
    { provide: PaymentRepository, useExisting: PaymentRepositoryImpl },
  ],
  exports: [FonepayService, { provide: PaymentRepository, useExisting: PaymentRepositoryImpl }],
})
export class PaymentsModule {}
