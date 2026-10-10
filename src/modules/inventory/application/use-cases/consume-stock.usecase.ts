import { Injectable } from "@nestjs/common";
import { StockMovementReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { ConsumeStockInput } from "../../interfaces/http/validations/consume-stock.validation";
import { InventoryService } from "../inventory.service";

/**
 * Takes an amount off stock by hand: for a dish when stock isn't consumed automatically, or for waste
 * or a staff meal. It never goes below zero, the oldest lots are drawn down like any other use, and
 * a dish that can no longer be made sells out as usual.
 */
@Injectable()
export class ConsumeStockUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(id: string, dto: ConsumeStockInput, authEntity: AuthEntity): Promise<IIngredient> {
    if (dto.dishId && !(await this.inventoryRepository.findDishInBranch(dto.dishId, authEntity.branchId))) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.DISH_NOT_FOUND);
    }

    return this.inventoryRepository.$transaction(async tx => {
      const existing = await this.inventoryRepository.findIngredient(id, { tx });
      if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
      if (dto.quantity > existing.quantity) throw new BadRequestException(INVENTORY_ERROR_MESSAGES.USE_EXCEEDS_STOCK);

      const updated = await this.inventoryRepository.applyMovement(
        id,
        -dto.quantity,
        {
          reason: StockMovementReason.MANUAL_USE,
          dishId: dto.dishId,
          note: dto.note,
          createdBy: authEntity.sub,
          createdAt: dto.usedAt ? new Date(dto.usedAt) : undefined,
        },
        tx
      );
      await this.inventoryService.drawFromLots(id, dto.quantity, undefined, tx);
      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      return updated;
    });
  }
}
