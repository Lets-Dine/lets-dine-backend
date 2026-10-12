import { Injectable } from "@nestjs/common";
import { SupplierIssueKind } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { SUPPLIERS_ERROR_MESSAGES } from "../../domain/constants";
import { ISupplierDetail } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { owedOf } from "../../domain/utils/owed.util";
import { ingredientPrices, withCheaper } from "../../domain/utils/supplier-prices.util";

/** The page shows this many; the rest is one tap away in a modal. */
export const PREVIEW = 5;
/** Prices are worked out from this many of the latest deliveries. */
export const PRICE_HISTORY = 1000;
const RECENT = 20;

/** One supplier by name (saved or only seen on deliveries): details, what is owed, deliveries, price movement and issues. */
@Injectable()
export class FetchSupplierDetailUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(name: string, authEntity: AuthEntity): Promise<ISupplierDetail> {
    const { restaurantId, branchId } = authEntity;
    const [saved, deliveries, stats, paid, payments] = await Promise.all([
      this.suppliersRepository.findSupplierByName(restaurantId, name),
      this.suppliersRepository.findDeliveries(branchId, name, PRICE_HISTORY),
      this.suppliersRepository.findDeliveryStats(branchId),
      this.suppliersRepository.findPaidTotals(branchId),
      this.suppliersRepository.findPayments(branchId, name, RECENT),
    ]);
    if (!saved && deliveries.length === 0) throw new NotFoundException(SUPPLIERS_ERROR_MESSAGES.NOT_FOUND);
    const st = stats.get(name.toLowerCase()) ?? { name, deliveries: 0, spent: 0, credit: 0, lastDeliveryAt: null };
    const shown = saved?.name ?? st.name;
    const prices = ingredientPrices(deliveries);
    const shownPrices = prices.slice(0, PREVIEW);
    const others = await this.suppliersRepository.findOtherPrices(branchId, shownPrices.map(p => p.ingredientId), shown);
    const [issues, counts, returns] = await Promise.all([
      this.suppliersRepository.findIssues(restaurantId, shown, RECENT),
      this.suppliersRepository.countIssues(restaurantId, shown),
      this.suppliersRepository.findReturns(branchId, shown, RECENT),
    ]);
    return {
      id: saved?.id ?? null,
      name: shown,
      phone: saved?.phone ?? "",
      note: saved?.note ?? "",
      deliveries: st.deliveries,
      spent: st.spent,
      credit: st.credit,
      lastDeliveryAt: st.lastDeliveryAt,
      owed: owedOf(st.credit, paid.get(shown.toLowerCase()) ?? 0),
      deliveriesList: deliveries.slice(0, PREVIEW),
      deliveriesTotal: st.deliveries,
      prices: withCheaper(shownPrices, others),
      pricesTotal: prices.length,
      payments,
      returns,
      issues,
      issueCounts: Object.fromEntries(Object.values(SupplierIssueKind).map(k => [k, counts[k] ?? 0])) as Record<SupplierIssueKind, number>,
    };
  }
}
