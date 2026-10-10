import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDishMargin } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { computeMargin } from "../../domain/utils/margin.util";

/**
 * What each dish costs to make at today's prices, and what that leaves. A dish with variants is
 * costed per variant, since the variant sets the price (and may add its own ingredients).
 * Ordered worst margin first, so the dishes to look at are on top.
 */
@Injectable()
export class FetchDishMarginsUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(authEntity: AuthEntity): Promise<IDishMargin[]> {
    const [dishes, costs] = await Promise.all([
      this.inventoryRepository.findDishRecipes(authEntity.branchId),
      this.inventoryRepository.findUnitCosts(authEntity.branchId),
    ]);

    const rows: IDishMargin[] = [];
    for (const dish of dishes) {
      if (dish.variants.length === 0) {
        rows.push({
          dishId: dish.id,
          name: dish.name,
          variantName: null,
          price: dish.price,
          ...computeMargin(dish.price, dish.baseLines, costs),
        });
        continue;
      }
      for (const variant of dish.variants) {
        const lines = [...dish.baseLines, ...dish.variantLines.filter(l => l.variantId === variant.id)];
        rows.push({
          dishId: dish.id,
          name: dish.name,
          variantName: variant.name,
          price: variant.price,
          ...computeMargin(variant.price, lines, costs),
        });
      }
    }
    return rows.sort((a, b) => a.margin - b.margin);
  }
}
