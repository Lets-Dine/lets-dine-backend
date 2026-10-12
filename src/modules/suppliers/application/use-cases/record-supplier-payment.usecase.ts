import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { SUPPLIERS_ERROR_MESSAGES } from "../../domain/constants";
import { IPayment } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { owedOf } from "../../domain/utils/owed.util";
import { RecordPaymentInput } from "../../interfaces/http/validations/record-payment.validation";

/**
 * Pays down what a supplier is owed from credit deliveries, and books the money in the cash book.
 * More than is owed is refused, which catches a mistyped amount.
 */
@Injectable()
export class RecordSupplierPaymentUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(dto: RecordPaymentInput, authEntity: AuthEntity): Promise<IPayment> {
    const { restaurantId, branchId } = authEntity;
    const [saved, stats, paid] = await Promise.all([
      this.suppliersRepository.findSupplierByName(restaurantId, dto.supplier),
      this.suppliersRepository.findDeliveryStats(branchId),
      this.suppliersRepository.findPaidTotals(branchId),
    ]);
    const seen = stats.get(dto.supplier.toLowerCase());
    const name = saved?.name ?? seen?.name;
    if (!name) throw new NotFoundException(SUPPLIERS_ERROR_MESSAGES.NOT_FOUND);
    // ponytail: read-then-write, so two payments at the same instant could both pass; add a row lock if it ever matters.
    if (dto.amount > owedOf(seen?.credit ?? 0, paid.get(name.toLowerCase()) ?? 0)) throw new BadRequestException(SUPPLIERS_ERROR_MESSAGES.PAYMENT_EXCEEDS_OWED);
    return this.suppliersRepository.createPayment({
      restaurantId,
      branchId,
      supplier: name,
      amount: dto.amount,
      method: dto.method,
      note: dto.note,
      createdBy: authEntity.sub,
      createdByName: authEntity.name,
    });
  }
}
