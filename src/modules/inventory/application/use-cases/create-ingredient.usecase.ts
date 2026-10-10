import { Injectable } from "@nestjs/common";
import { StockMovementReason } from "@prisma/client";
import { ConflictException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { CreateIngredientInput } from "../../interfaces/http/validations/create-ingredient.validation";
import { InventoryService } from "../inventory.service";

@Injectable()
export class CreateIngredientUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  /**
   * "Removing" an ingredient only archives it (recipes and history still point at it), and its name
   * stays taken. Adding the same name again therefore brings the old one back rather than clashing:
   * recipes survive, the shelf count starts again from what was entered, and old batches are closed
   * so they can't be blamed for new reviews. A different unit makes the old recipe quantities
   * meaningless, so those are cleared.
   */
  async execute(dto: CreateIngredientInput, authEntity: AuthEntity): Promise<IIngredient> {
    const { quantity, cost, ...rest } = dto;
    try {
      return await this.inventoryRepository.$transaction(async tx => {
        const existing = await this.inventoryRepository.findIngredientByName(authEntity.branchId, rest.name, tx);
        if (existing && !existing.isArchived) throw new ConflictException(INVENTORY_ERROR_MESSAGES.INGREDIENT_EXISTS);

        let ingredient: IIngredient;
        if (existing) {
          await this.inventoryRepository.closeOpenLots(existing.id, tx);
          if (existing.unit !== rest.unit) await this.inventoryRepository.clearRecipeLines(existing.id, tx);
          ingredient = await this.inventoryRepository.updateIngredient(
            existing.id,
            { isArchived: false, unit: rest.unit, parLevel: rest.parLevel },
            { tx }
          );
        } else {
          ingredient = await this.inventoryRepository.createIngredient(
            { ...rest, quantity: 0, restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
            { tx }
          );
        }

        // Opening stock goes through the same door as everything else, so the history starts complete.
        const delta = quantity - (existing?.quantity ?? 0);
        if (quantity > 0) {
          await this.inventoryRepository.createLot(
            { ingredientId: ingredient.id, quantity, cost: cost || undefined, createdBy: authEntity.sub },
            tx
          );
        }
        if (delta !== 0) {
          ingredient = await this.inventoryRepository.applyMovement(
            ingredient.id,
            delta,
            { reason: StockMovementReason.ADJUSTMENT, note: existing ? "Added back" : "Opening stock", createdBy: authEntity.sub },
            tx
          );
        }
        // A brought-back ingredient may be the one a sold-out dish was waiting on.
        if (existing) await this.inventoryService.syncAvailability(authEntity.branchId, [ingredient.id], tx);
        return ingredient;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException(INVENTORY_ERROR_MESSAGES.INGREDIENT_EXISTS);
      throw error;
    }
  }
}
