import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IPurchase } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { FetchPurchasesInput } from "../../interfaces/http/validations/fetch-purchases.validation";

/** The latest deliveries of one ingredient, newest first. */
@Injectable()
export class FetchIngredientPurchasesUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(ingredientId: string, query: FetchPurchasesInput, authEntity: AuthEntity): Promise<IPurchase[]> {
    const [ingredient] = await this.inventoryRepository.findIngredientsByIds([ingredientId], authEntity.branchId);
    if (!ingredient) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    return this.inventoryRepository.findPurchases(ingredientId, query.limit);
  }
}
