import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IUsagePage } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { FetchUsageInput } from "../../interfaces/http/validations/fetch-usage.validation";

/** When and for which dish one ingredient was used, newest first, a page at a time. */
@Injectable()
export class FetchIngredientUsageUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(ingredientId: string, query: FetchUsageInput, authEntity: AuthEntity): Promise<IUsagePage> {
    const [ingredient] = await this.inventoryRepository.findIngredientsByIds([ingredientId], authEntity.branchId);
    if (!ingredient) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    return this.inventoryRepository.findIngredientUsage(ingredientId, query.page, query.pageSize);
  }
}
