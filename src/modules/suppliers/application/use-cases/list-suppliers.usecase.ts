import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDeliveryStats, ISupplierListItem } from "../../domain/interfaces/suppliers.interface";
import { SuppliersRepository } from "../../domain/repositories/suppliers.repository";
import { owedOf } from "../../domain/utils/owed.util";

const NONE: IDeliveryStats = { deliveries: 0, spent: 0, credit: 0, lastDeliveryAt: null };

/**
 * Saved suppliers, plus any name that only appears on deliveries typed in before suppliers existed
 * (`id` null, so the page can offer to save it). Most recently delivered first, then by name.
 */
@Injectable()
export class ListSuppliersUsecase {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async execute(authEntity: AuthEntity): Promise<ISupplierListItem[]> {
    const [saved, stats, paid] = await Promise.all([
      this.suppliersRepository.findSuppliers(authEntity.restaurantId),
      this.suppliersRepository.findDeliveryStats(authEntity.branchId),
      this.suppliersRepository.findPaidTotals(authEntity.branchId),
    ]);
    const known = new Set(saved.map(s => s.name.toLowerCase()));
    const item = (id: string | null, name: string, phone: string, note: string, st: IDeliveryStats): ISupplierListItem => ({
      id,
      name,
      phone,
      note,
      deliveries: st.deliveries,
      spent: st.spent,
      credit: st.credit,
      lastDeliveryAt: st.lastDeliveryAt,
      owed: owedOf(st.credit, paid.get(name.toLowerCase()) ?? 0),
    });
    const items = [
      // An archived supplier is hidden until it has deliveries, so its history never shows as an unsaved name.
      ...saved.filter(s => !s.isArchived || stats.has(s.name.toLowerCase())).map(s => item(s.id, s.name, s.phone, s.note, stats.get(s.name.toLowerCase()) ?? NONE)),
      ...[...stats].filter(([key]) => !known.has(key)).map(([, st]) => item(null, st.name, "", "", st)),
    ];
    return items.sort((a, b) => (b.lastDeliveryAt?.getTime() ?? 0) - (a.lastDeliveryAt?.getTime() ?? 0) || a.name.localeCompare(b.name));
  }
}
