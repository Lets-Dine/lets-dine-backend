import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { SUPPLIERS_ERROR_MESSAGES } from "../../domain/constants";
import { ISupplierRecord } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { UpdateSupplierInput } from "../../interfaces/http/validations/update-supplier.validation";

@Injectable()
export class UpdateSupplierUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(id: string, dto: UpdateSupplierInput, authEntity: AuthEntity): Promise<ISupplierRecord> {
    const supplier = await this.suppliersRepository.findSupplier(id, authEntity.restaurantId);
    if (!supplier) throw new NotFoundException(SUPPLIERS_ERROR_MESSAGES.NOT_FOUND);
    return this.suppliersRepository.updateSupplier(id, dto);
  }
}
