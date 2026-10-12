import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { SUPPLIERS_ERROR_MESSAGES } from "../../domain/constants";
import { IIssue } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { LogIssueInput } from "../../interfaces/http/validations/log-issue.validation";

/** Notes that a supplier was late, short or poor, against its saved name (or the name on its deliveries). */
@Injectable()
export class LogSupplierIssueUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(dto: LogIssueInput, authEntity: AuthEntity): Promise<IIssue> {
    const [saved, stats] = await Promise.all([
      this.suppliersRepository.findSupplierByName(authEntity.restaurantId, dto.supplier),
      this.suppliersRepository.findDeliveryStats(authEntity.branchId),
    ]);
    const name = saved?.name ?? stats.get(dto.supplier.toLowerCase())?.name;
    if (!name) throw new NotFoundException(SUPPLIERS_ERROR_MESSAGES.NOT_FOUND);
    return this.suppliersRepository.createIssue({
      restaurantId: authEntity.restaurantId,
      supplier: name,
      kind: dto.kind,
      note: dto.note,
      createdBy: authEntity.sub,
      createdByName: authEntity.name,
    });
  }
}
