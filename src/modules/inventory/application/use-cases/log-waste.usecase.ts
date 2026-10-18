import { Injectable } from "@nestjs/common";
import { StockMovementReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { allocateFifo } from "../../domain/utils/lot.util";
import { wasteCost } from "../../domain/utils/waste.util";
import { LogWasteInput } from "../../interfaces/http/validations/log-waste.validation";
import { InventoryService } from "../inventory.service";

/**
 * Throws stock away with a reason. Like any use it never goes below zero and draws the oldest lots first,
 * but the entry also keeps what those lots cost, so the waste report can say rupees and not only grams.
 */
@Injectable()
export class LogWasteUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(id: string, dto: LogWasteInput, authEntity: AuthEntity): Promise<IIngredient> {
    return this.inventoryRepository.$transaction(async tx => {
      // Lots now drive money, so two wastes of one ingredient must not read the same lot at once.
      await this.inventoryRepository.lockIngredient(id, tx);
      const existing = await this.inventoryRepository.findIngredient(id, { tx });
      if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
      if (dto.quantity > existing.quantity) throw new BadRequestException(INVENTORY_ERROR_MESSAGES.USE_EXCEEDS_STOCK);

      const lots = await this.inventoryRepository.findOpenLotDetails(id, tx);
      const allocations = allocateFifo(lots, dto.quantity);
      const updated = await this.inventoryRepository.applyMovement(
        id,
        -dto.quantity,
        {
          reason: StockMovementReason.WASTE,
          wasteReason: dto.reason,
          wasteCost: wasteCost(lots, allocations, dto.quantity),
          note: dto.note,
          createdBy: authEntity.sub,
        },
        tx
      );
      await this.inventoryRepository.applyLotUse(allocations, undefined, tx);
      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      return updated;
    });
  }
}
