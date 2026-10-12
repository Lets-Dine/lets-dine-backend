import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDelivery, IPage } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { FetchSupplierPageInput } from "../../interfaces/http/validations/fetch-supplier-page.validation";

/** One page of a supplier's deliveries, newest first, for the "view all" list. */
@Injectable()
export class FetchSupplierDeliveriesUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(query: FetchSupplierPageInput, authEntity: AuthEntity): Promise<IPage<IDelivery>> {
    const [rows, stats] = await Promise.all([
      this.suppliersRepository.findDeliveries(authEntity.branchId, query.name, query.limit, query.offset),
      this.suppliersRepository.findDeliveryStats(authEntity.branchId),
    ]);
    return { rows, count: stats.get(query.name.toLowerCase())?.deliveries ?? 0 };
  }
}
