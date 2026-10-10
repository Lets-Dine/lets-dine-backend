import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { UpdateIngredientInput } from "../../interfaces/http/validations/update-ingredient.validation";

@Injectable()
export class UpdateIngredientUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(id: string, dto: UpdateIngredientInput, authEntity: AuthEntity): Promise<IIngredient> {
    const existing = await this.inventoryRepository.findIngredient(id);
    if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    try {
      return await this.inventoryRepository.updateIngredient(id, dto);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException(INVENTORY_ERROR_MESSAGES.INGREDIENT_EXISTS);
      throw error;
    }
  }
}
