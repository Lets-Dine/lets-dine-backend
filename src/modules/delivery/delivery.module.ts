import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerModule } from "../ledger/ledger.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { AssignDeliveryUsecase } from "./application/use-cases/assign-delivery.usecase";
import { CompleteDeliveryUsecase } from "./application/use-cases/complete-delivery.usecase";
import { CreatePartnerUsecase } from "./application/use-cases/create-partner.usecase";
import { CreateRiderUsecase } from "./application/use-cases/create-rider.usecase";
import { GetCourierDetailUsecase } from "./application/use-cases/get-courier-detail.usecase";
import { GetCourierStatementUsecase } from "./application/use-cases/get-courier-statement.usecase";
import { GetDeliveryOverviewUsecase } from "./application/use-cases/get-delivery-overview.usecase";
import { GetDispatchCouriersUsecase } from "./application/use-cases/get-dispatch-couriers.usecase";
import { GetOrderAssignmentUsecase } from "./application/use-cases/get-order-assignment.usecase";
import { SettleDeliveryOrderUsecase } from "./application/use-cases/settle-delivery-order.usecase";
import { RecordSettlementUsecase } from "./application/use-cases/record-settlement.usecase";
import { UpdatePartnerUsecase } from "./application/use-cases/update-partner.usecase";
import { UpdateRiderUsecase } from "./application/use-cases/update-rider.usecase";
import { DeliveryRepository } from "./domain/repositories/delivery.repository";
import DeliveryRepositoryImpl from "./infrastructure/repositories/delivery.repository.impl";
import { DeliveryController } from "./interfaces/http/delivery.controller";

@Module({
  imports: [AuditLogsModule, LedgerModule, LoyaltyModule, OrdersModule, PaymentsModule],
  controllers: [DeliveryController],
  providers: [
    GetDeliveryOverviewUsecase,
    GetCourierDetailUsecase,
    GetCourierStatementUsecase,
    GetDispatchCouriersUsecase,
    CreatePartnerUsecase,
    UpdatePartnerUsecase,
    CreateRiderUsecase,
    UpdateRiderUsecase,
    GetOrderAssignmentUsecase,
    AssignDeliveryUsecase,
    CompleteDeliveryUsecase,
    SettleDeliveryOrderUsecase,
    RecordSettlementUsecase,
    DeliveryRepositoryImpl,
    { provide: DeliveryRepository, useExisting: DeliveryRepositoryImpl },
  ],
})
export class DeliveryModule {}
