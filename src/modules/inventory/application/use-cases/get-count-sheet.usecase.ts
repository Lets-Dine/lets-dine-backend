import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";

/** The blank count sheet: names and units only. Expected quantities are deliberately never sent. */
@Injectable()
export class GetCountSheetUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(authEntity: AuthEntity): Promise<{ ingredientId: string; name: string; unit: string }[]> {
    const ingredients = await this.inventoryRepository.findIngredients(authEntity.branchId);
    return ingredients.map(({ id, name, unit }) => ({ ingredientId: id, name, unit }));
  }
}
