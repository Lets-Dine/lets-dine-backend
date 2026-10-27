import { Module } from "@nestjs/common";
import { CreatePrinterUsecase } from "./application/use-cases/create-printer.usecase";
import { DeletePrinterUsecase } from "./application/use-cases/delete-printer.usecase";
import { FetchPrintersUsecase } from "./application/use-cases/fetch-printers.usecase";
import { UpdatePrinterUsecase } from "./application/use-cases/update-printer.usecase";
import { PrinterRepository } from "./domain/repositories/printer.repository";
import PrinterRepositoryImpl from "./infrastructure/repositories/printer.repository.impl";
import { PrinterController } from "./interfaces/http/printer.controller";

@Module({
  controllers: [PrinterController],
  providers: [
    FetchPrintersUsecase,
    CreatePrinterUsecase,
    UpdatePrinterUsecase,
    DeletePrinterUsecase,
    PrinterRepositoryImpl,
    { provide: PrinterRepository, useExisting: PrinterRepositoryImpl },
  ],
  exports: [{ provide: PrinterRepository, useExisting: PrinterRepositoryImpl }],
})
export class PrintersModule {}
