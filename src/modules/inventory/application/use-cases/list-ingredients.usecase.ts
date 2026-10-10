import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";

@Injectable()
export class ListIngredientsUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(authEntity: AuthEntity): Promise<IIngredient[]> {
    return this.inventoryRepository.findIngredients(authEntity.branchId);
  }
}
