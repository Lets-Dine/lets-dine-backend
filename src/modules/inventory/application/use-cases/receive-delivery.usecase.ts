import { Injectable } from "@nestjs/common";
import { ExpenseKind, StockMovementReason } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { ReceiveDeliveryInput } from "../../interfaces/http/validations/receive-delivery.validation";
import { InventoryService } from "../inventory.service";

@Injectable()
export class ReceiveDeliveryUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(id: string, dto: ReceiveDeliveryInput, authEntity: AuthEntity): Promise<IIngredient> {
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : undefined;
    return this.inventoryRepository.$transaction(async tx => {
      const existing = await this.inventoryRepository.findIngredient(id, { tx });
      if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);

      const updated = await this.inventoryRepository.applyMovement(
        id,
        dto.quantity,
        {
          reason: StockMovementReason.DELIVERY,
          supplier: dto.supplier || undefined,
          cost: dto.cost || undefined,
          createdBy: authEntity.sub,
          createdAt: receivedAt,
        },
        tx
      );

      await this.inventoryRepository.createLot(
        {
          ingredientId: id,
          receivedAt,
          supplier: dto.supplier || undefined,
          cost: dto.cost || undefined,
          quantity: dto.quantity,
          createdBy: authEntity.sub,
        },
        tx
      );

      // The delivery is a purchase: it lands in the books too, so nobody types it twice.
      if (dto.cost > 0) {
        await this.inventoryRepository.createStockExpense(
          {
            restaurantId: authEntity.restaurantId,
            branchId: authEntity.branchId,
            kind: ExpenseKind.EXPENSE,
            amount: dto.cost,
            method: dto.method,
            category: "stock",
            note: [existing.name, dto.supplier].filter(Boolean).join(" — "),
            createdBy: authEntity.sub,
            createdByName: authEntity.name,
            createdAt: receivedAt,
          },
          tx
        );
      }

      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      return updated;
    });
  }
}
