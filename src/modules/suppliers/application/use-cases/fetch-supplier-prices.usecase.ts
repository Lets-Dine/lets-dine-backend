import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IIngredientPrice, IPage } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { ingredientPrices, withCheaper } from "../../domain/utils/supplier-prices.util";
import { FetchSupplierPageInput } from "../../interfaces/http/validations/fetch-supplier-page.validation";
import { PRICE_HISTORY } from "./fetch-supplier-detail.usecase";

/** One page of a supplier's ingredient prices, by ingredient name, for the "view all" list. */
@Injectable()
export class FetchSupplierPricesUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(query: FetchSupplierPageInput, authEntity: AuthEntity): Promise<IPage<IIngredientPrice>> {
    // ponytail: prices come from the latest PRICE_HISTORY deliveries, worked out in memory; move to SQL if a supplier outgrows that.
    const prices = ingredientPrices(await this.suppliersRepository.findDeliveries(authEntity.branchId, query.name, PRICE_HISTORY));
    const rows = prices.slice(query.offset, query.offset + query.limit);
    const others = await this.suppliersRepository.findOtherPrices(authEntity.branchId, rows.map(p => p.ingredientId), query.name);
    return { rows: withCheaper(rows, others), count: prices.length };
  }
}
