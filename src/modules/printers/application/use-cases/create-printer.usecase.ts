import { Injectable } from "@nestjs/common";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { PRINTER_ERROR_MESSAGES } from "../../domain/constants";
import { IPrinter } from "../../domain/interfaces/printer.interface";
import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { CreatePrinterInput } from "../../interfaces/http/validations/create-printer.validation";

@Injectable()
export class CreatePrinterUsecase {
  constructor(private readonly printerRepository: PrinterRepository) {}

  async execute(dto: CreatePrinterInput, authEntity: AuthEntity): Promise<IPrinter> {
    if (await this.printerRepository.findByName(authEntity.branchId, dto.name)) {
      throw new ConflictException(PRINTER_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
    }
    try {
      return await this.printerRepository.create({ ...dto, branchId: authEntity.branchId });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException(PRINTER_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
      throw error;
    }
  }
}
