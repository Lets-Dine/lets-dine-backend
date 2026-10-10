import { Injectable } from "@nestjs/common";
import { StockMovementReason } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { AdjustStockInput } from "../../interfaces/http/validations/adjust-stock.validation";
import { InventoryService } from "../inventory.service";

@Injectable()
export class AdjustStockUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(id: string, dto: AdjustStockInput, authEntity: AuthEntity): Promise<IIngredient> {
    return this.inventoryRepository.$transaction(async tx => {
      const existing = await this.inventoryRepository.findIngredient(id, { tx });
      if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);

      const delta = dto.quantity - existing.quantity;
      if (delta === 0) return existing;

      const updated = await this.inventoryRepository.applyMovement(
        id,
        delta,
        { reason: StockMovementReason.ADJUSTMENT, note: dto.note, createdBy: authEntity.sub },
        tx
      );
      if (delta < 0) await this.inventoryService.drawFromLots(id, -delta, undefined, tx);
      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      return updated;
    });
  }
}
