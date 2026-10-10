import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredientSummary } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_DAYS = 30;

/** What came in and went out of one ingredient lately, its latest movement, and where it was last bought. */
@Injectable()
export class FetchIngredientSummaryUsecase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async execute(ingredientId: string, authEntity: AuthEntity): Promise<IIngredientSummary> {
    const [ingredient] = await this.inventoryRepository.findIngredientsByIds([ingredientId], authEntity.branchId);
    if (!ingredient) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
    const summary = await this.inventoryRepository.findIngredientSummary(ingredientId, new Date(Date.now() - SUMMARY_DAYS * DAY_MS));
    return { days: SUMMARY_DAYS, ...summary };
  }
}
