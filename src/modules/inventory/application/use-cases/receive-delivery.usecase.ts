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
    // A typed name that matches a saved supplier (in any case) is stored as that supplier's name.
    const supplier = dto.supplier ? ((await this.inventoryRepository.findSupplierName(authEntity.restaurantId, dto.supplier)) ?? dto.supplier) : "";
    return this.inventoryRepository.$transaction(async tx => {
      const existing = await this.inventoryRepository.findIngredient(id, { tx });
      if (!existing || !isInActiveBranch(authEntity, existing)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);

      const updated = await this.inventoryRepository.applyMovement(
        id,
        dto.quantity,
        {
          reason: StockMovementReason.DELIVERY,
          supplier: supplier || undefined,
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
          supplier: supplier || undefined,
          cost: dto.cost || undefined,
          quantity: dto.quantity,
          createdBy: authEntity.sub,
          onCredit: dto.onCredit,
        },
        tx
      );

      // The delivery is a purchase: it lands in the books too, so nobody types it twice. On credit it
      // lands when it is paid (see suppliers), not now.
      if (dto.cost > 0 && !dto.onCredit) {
        await this.inventoryRepository.createStockExpense(
          {
            restaurantId: authEntity.restaurantId,
            branchId: authEntity.branchId,
            kind: ExpenseKind.EXPENSE,
            amount: dto.cost,
            method: dto.method,
            category: "stock",
            note: [existing.name, supplier].filter(Boolean).join(" — "),
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
