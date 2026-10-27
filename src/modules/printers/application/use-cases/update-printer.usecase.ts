import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { PRINTER_ERROR_MESSAGES } from "../../domain/constants";
import { IPrinter } from "../../domain/interfaces/printer.interface";
import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { UpdatePrinterInput } from "../../interfaces/http/validations/update-printer.validation";

@Injectable()
export class UpdatePrinterUsecase {
  constructor(private readonly printerRepository: PrinterRepository) {}

  async execute(id: string, dto: UpdatePrinterInput, authEntity: AuthEntity): Promise<IPrinter> {
    const existing = await this.printerRepository.findById(id);
    if (!existing || existing.branchId !== authEntity.branchId) throw new NotFoundException(PRINTER_ERROR_MESSAGES.NOT_FOUND);

    if (dto.name && dto.name !== existing.name && (await this.printerRepository.findByName(authEntity.branchId, dto.name))) {
      throw new ConflictException(PRINTER_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
    }
    if (dto.isActive === false && existing.isActive) await this.printerRepository.dropPendingJobs(id);
    try {
      return await this.printerRepository.update(id, dto);
    } catch (error) {
      // Two requests racing past the name check: the unique index decides, and that is a conflict, not a crash.
      if ((error as { code?: string }).code === "P2002") throw new ConflictException(PRINTER_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
      throw error;
    }
  }
}
