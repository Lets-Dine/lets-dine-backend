import { Injectable } from "@nestjs/common";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { SUPPLIERS_ERROR_MESSAGES } from "../../domain/constants";
import { ISupplierRecord } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { CreateSupplierInput } from "../../interfaces/http/validations/create-supplier.validation";

@Injectable()
export class CreateSupplierUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  /** An archived supplier of the same name is brought back with the new details, rather than clashing. */
  async execute(dto: CreateSupplierInput, authEntity: AuthEntity): Promise<ISupplierRecord> {
    const existing = await this.suppliersRepository.findSupplierByName(authEntity.restaurantId, dto.name);
    if (existing && !existing.isArchived) throw new ConflictException(SUPPLIERS_ERROR_MESSAGES.EXISTS);
    if (existing) return this.suppliersRepository.updateSupplier(existing.id, { phone: dto.phone || existing.phone, note: dto.note || existing.note, isArchived: false });
    try {
      return await this.suppliersRepository.createSupplier({ ...dto, restaurantId: authEntity.restaurantId, createdBy: authEntity.sub });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException(SUPPLIERS_ERROR_MESSAGES.EXISTS);
      throw error;
    }
  }
}
