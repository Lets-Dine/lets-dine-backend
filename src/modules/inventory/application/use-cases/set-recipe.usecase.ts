import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IRecipeLine } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { SetRecipeInput } from "../../interfaces/http/validations/set-recipe.validation";

@Injectable()
export class SetRecipeUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  /** Replaces the dish's whole recipe — the editor always sends the full list. */
  async execute(dishId: string, dto: SetRecipeInput, authEntity: AuthEntity): Promise<IRecipeLine[]> {
    if (!(await this.inventoryRepository.findDishInBranch(dishId, authEntity.branchId))) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.DISH_NOT_FOUND);
    }
    const ids = [...new Set(dto.lines.map(line => line.ingredientId))];
    const found = await this.inventoryRepository.findIngredientsByIds(ids, authEntity.branchId);
    // An ingredient from another branch is indistinguishable from a missing one.
    if (found.length !== ids.length) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    return this.inventoryRepository.replaceRecipe(dishId, dto.lines);
  }
}
