import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { PRINTER_ERROR_MESSAGES } from "../../domain/constants";
import { PrinterRepository } from "../../domain/repositories/printer.repository";

@Injectable()
export class DeletePrinterUsecase {
  constructor(private readonly printerRepository: PrinterRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const existing = await this.printerRepository.findById(id);
    if (!existing || existing.branchId !== authEntity.branchId) throw new NotFoundException(PRINTER_ERROR_MESSAGES.NOT_FOUND);
    // Its unprinted jobs go with it (cascade) — a removed printer has nowhere to print them.
    await this.printerRepository.delete(id);
  }
}
