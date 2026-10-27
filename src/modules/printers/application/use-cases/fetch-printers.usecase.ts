import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IPrinter } from "../../domain/interfaces/printer.interface";
import { PrinterRepository } from "../../domain/repositories/printer.repository";

@Injectable()
export class FetchPrintersUsecase {
  constructor(private readonly printerRepository: PrinterRepository) {}

  execute(authEntity: AuthEntity): Promise<IPrinter[]> {
    return this.printerRepository.findByBranch(authEntity.branchId);
  }
}
