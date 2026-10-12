import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IReturnableLot } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";

/** The deliveries of one ingredient that still have stock that can be sent back. */
@Injectable()
export class FetchReturnableLotsUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(ingredientId: string, authEntity: AuthEntity): Promise<IReturnableLot[]> {
    const [ingredient] = await this.inventoryRepository.findIngredientsByIds([ingredientId], authEntity.branchId);
    if (!ingredient) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    return this.inventoryRepository.findReturnableLots(ingredientId);
  }
}
