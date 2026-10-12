import { Module } from "@nestjs/common";
import { CreateSupplierUsecase } from "./application/use-cases/create-supplier.usecase";
import { FetchSupplierDetailUsecase } from "./application/use-cases/fetch-supplier-detail.usecase";
import { FetchSupplierDeliveriesUsecase } from "./application/use-cases/fetch-supplier-deliveries.usecase";
import { FetchSupplierPricesUsecase } from "./application/use-cases/fetch-supplier-prices.usecase";
import { LogSupplierIssueUsecase } from "./application/use-cases/log-supplier-issue.usecase";
import { RecordSupplierPaymentUsecase } from "./application/use-cases/record-supplier-payment.usecase";
import { ListSuppliersUsecase } from "./application/use-cases/list-suppliers.usecase";
import { UpdateSupplierUsecase } from "./application/use-cases/update-supplier.usecase";
import { SuppliersRepository } from "./domain/repositories/suppliers.repository";
import SuppliersRepositoryImpl from "./infrastructure/repositories/suppliers.repository.impl";
import { SuppliersController } from "./interfaces/http/suppliers.controller";

@Module({
  controllers: [SuppliersController],
  providers: [
    ListSuppliersUsecase,
    FetchSupplierDetailUsecase,
    CreateSupplierUsecase,
    UpdateSupplierUsecase,
    RecordSupplierPaymentUsecase,
    LogSupplierIssueUsecase,
    FetchSupplierDeliveriesUsecase,
    FetchSupplierPricesUsecase,
    SuppliersRepositoryImpl,
    { provide: SuppliersRepository, useExisting: SuppliersRepositoryImpl },
  ],
})
export class SuppliersModule {}
