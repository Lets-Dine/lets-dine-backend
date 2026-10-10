import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IBuyListItem } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { forecastByWeekday, HISTORY_WEEKS, quantityToBuy } from "../../domain/utils/forecast.util";
import { FetchBuyListInput } from "../../interfaces/http/validations/fetch-buy-list.validation";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What to order for the next few days: each ingredient's expected use (from the same weekdays of
 * the last three weeks, recent ones counting more) plus its warning line, less what is on the shelf. Priced and attributed to
 * the supplier it was last bought from, so the list can go straight to them.
 */
@Injectable()
export class FetchBuyListUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(query: FetchBuyListInput, authEntity: AuthEntity): Promise<IBuyListItem[]> {
    const now = new Date();
    const since = new Date(now.getTime() - HISTORY_WEEKS * 7 * DAY_MS);
    const [ingredients, usage, purchases, timeZone] = await Promise.all([
      this.inventoryRepository.findIngredients(authEntity.branchId),
      this.inventoryRepository.findUsage(authEntity.branchId, since),
      this.inventoryRepository.findLastPurchases(authEntity.branchId),
      this.inventoryRepository.findBranchTimezone(authEntity.branchId),
    ]);

    return ingredients
      .map(ingredient => {
        const { expectedUse, toBuy } = quantityToBuy({
          onHand: ingredient.quantity,
          parLevel: ingredient.parLevel,
          byWeekday: forecastByWeekday(usage.get(ingredient.id) ?? [], timeZone, now),
          now,
          horizonDays: query.days,
          timeZone,
        });
        const purchase = purchases.get(ingredient.id);
        return {
          ingredientId: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          onHand: ingredient.quantity,
          parLevel: ingredient.parLevel,
          expectedUse,
          toBuy,
          supplier: purchase?.supplier ?? null,
          estimatedCost: purchase?.cost ? Math.round((toBuy * purchase.cost) / purchase.quantity) : null,
        };
      })
      .filter(item => item.toBuy > 0)
      .sort((a, b) => (a.supplier ?? "\uffff").localeCompare(b.supplier ?? "\uffff") || a.name.localeCompare(b.name));
  }
}
