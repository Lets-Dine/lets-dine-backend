import { Module } from "@nestjs/common";
import { RemindReceivableUsecase } from "./application/use-cases/remind-receivable.usecase";
import { ReceivableRepository } from "./infrastructure/receivable.repository";
import { ReceivableController } from "./interfaces/http/receivable.controller";

@Module({
  controllers: [ReceivableController],
  providers: [ReceivableRepository, RemindReceivableUsecase],
})
export class ReceivablesModule {}
