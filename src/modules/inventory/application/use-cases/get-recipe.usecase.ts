import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IRecipeLine } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";

@Injectable()
export class GetRecipeUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(dishId: string, authEntity: AuthEntity): Promise<IRecipeLine[]> {
    if (!(await this.inventoryRepository.findDishInBranch(dishId, authEntity.branchId))) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.DISH_NOT_FOUND);
    }
    return this.inventoryRepository.findRecipeLines(dishId);
  }
}
