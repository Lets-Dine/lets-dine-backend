import { Injectable } from "@nestjs/common";
import { ExpenseKind, StockMovementReason } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { ReturnStockInput } from "../../interfaces/http/validations/return-stock.validation";
import { InventoryService } from "../inventory.service";

/**
 * Sends part (or all) of one delivery back to its supplier. Only what is still left of that delivery
 * can go. The supplier gives back up to that share of what was paid: off what is owed when the delivery
 * was on credit (up to what is still owed), otherwise money back, which the cash book records as income.
 */
@Injectable()
export class ReturnStockUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(id: string, dto: ReturnStockInput, authEntity: AuthEntity): Promise<IIngredient> {
    return this.inventoryRepository.$transaction(async tx => {
      const ingredient = await this.inventoryRepository.findIngredient(id, { tx });
      if (!ingredient || ingredient.isArchived || !isInActiveBranch(authEntity, ingredient))
        throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);

      const lot = await this.inventoryRepository.findLot(dto.lotId, tx);
      if (!lot || lot.ingredientId !== id || !lot.supplier || lot.fromTransfer)
        throw new NotFoundException(INVENTORY_ERROR_MESSAGES.LOT_NOT_FOUND);
      // A lot can show more left than the shelf holds (stock that went negative belongs to no lot), and that part was already used.
      if (dto.quantity > Math.min(lot.remaining, ingredient.quantity))
        throw new BadRequestException(INVENTORY_ERROR_MESSAGES.RETURN_EXCEEDS_LOT);

      // Their share of the price, never more than what is left of it after earlier returns from this delivery.
      const refunded = await this.inventoryRepository.findLotRefunded(lot.id, tx);
      const share = lot.cost ? Math.min(Math.round((lot.cost * dto.quantity) / lot.quantity), Math.max(0, lot.cost - refunded)) : 0;
      const refund = dto.refund ?? share;
      if (refund > share) throw new BadRequestException(INVENTORY_ERROR_MESSAGES.REFUND_TOO_HIGH);

      // On credit the refund first comes off what is still owed; anything beyond that was already paid for, so it is money back.
      const owedOffset = lot.onCredit
        ? Math.min(refund, await this.inventoryRepository.findSupplierOwed(authEntity.branchId, lot.supplier, tx))
        : 0;
      const moneyBack = refund - owedOffset;

      if (!(await this.inventoryRepository.reduceLot(lot.id, dto.quantity, tx)))
        throw new BadRequestException(INVENTORY_ERROR_MESSAGES.RETURN_EXCEEDS_LOT);
      const updated = await this.inventoryRepository.applyMovement(
        id,
        -dto.quantity,
        {
          reason: StockMovementReason.RETURN,
          supplier: lot.supplier,
          cost: refund || undefined,
          note: dto.note,
          createdBy: authEntity.sub,
        },
        tx
      );
      await this.inventoryRepository.createSupplierReturn(
        {
          restaurantId: authEntity.restaurantId,
          branchId: authEntity.branchId,
          ingredientId: id,
          lotId: lot.id,
          supplier: lot.supplier,
          quantity: dto.quantity,
          amount: refund,
          onCredit: lot.onCredit,
          owedOffset,
          method: dto.method,
          note: dto.note,
          createdBy: authEntity.sub,
        },
        tx
      );

      // Money back lands in the books now. What came off what is owed was never paid, so it is not income.
      if (moneyBack > 0) {
        await this.inventoryRepository.createStockExpense(
          {
            restaurantId: authEntity.restaurantId,
            branchId: authEntity.branchId,
            kind: ExpenseKind.INCOME,
            amount: moneyBack,
            method: dto.method,
            category: "stock",
            note: [`Refund from ${lot.supplier}`, ingredient.name].join(" — "),
            createdBy: authEntity.sub,
            createdByName: authEntity.name,
          },
          tx
        );
      }

      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      return updated;
    });
  }
}
