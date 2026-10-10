import { Injectable } from "@nestjs/common";
import { AuditAction, StockMovementReason } from "@prisma/client";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, canAccessBranch, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { INVENTORY_ERROR_MESSAGES } from "../../domain/constants";
import { IIngredient } from "../../domain/interfaces/inventory.interface";
import { InventoryRepository } from "../../domain/repositories/inventory.repository";
import { allocateFifo } from "../../domain/utils/lot.util";
import { TransferStockInput } from "../../interfaces/http/validations/transfer-stock.validation";
import { InventoryService } from "../inventory.service";

/**
 * Moves stock from this branch to another of the same restaurant. The ingredient is matched by name
 * on the other side (and created there if it is new to that branch), and the oldest lots travel
 * with it — same supplier, same date, price scaled to the share sent — so a delivery that ends up
 * in another kitchen can still be traced.
 */
@Injectable()
export class TransferStockUsecase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: TransferStockInput, authEntity: AuthEntity): Promise<IIngredient> {
    if (dto.toBranchId === authEntity.branchId) throw new BadRequestException(INVENTORY_ERROR_MESSAGES.TRANSFER_SAME_BRANCH);

    const target = await this.inventoryRepository.findBranch(dto.toBranchId);
    // Another restaurant's branch is indistinguishable from a missing one.
    if (!target || target.restaurantId !== authEntity.restaurantId || !target.isActive) {
      throw new NotFoundException(INVENTORY_ERROR_MESSAGES.BRANCH_NOT_FOUND);
    }
    if (!canAccessBranch(authEntity, target.id)) throw new ForbiddenException(INVENTORY_ERROR_MESSAGES.BRANCH_FORBIDDEN);

    return this.inventoryRepository.$transaction(async tx => {
      const source = await this.inventoryRepository.findIngredient(id, { tx });
      if (!source || !isInActiveBranch(authEntity, source)) throw new NotFoundException(INVENTORY_ERROR_MESSAGES.INGREDIENT_NOT_FOUND);
      if (dto.quantity > source.quantity) throw new BadRequestException(INVENTORY_ERROR_MESSAGES.INSUFFICIENT_STOCK);

      let destination = await this.inventoryRepository.findIngredientByName(target.id, source.name, tx);
      if (destination && destination.unit !== source.unit) throw new ConflictException(INVENTORY_ERROR_MESSAGES.UNIT_MISMATCH);
      if (!destination) {
        destination = await this.inventoryRepository.createIngredient(
          { restaurantId: authEntity.restaurantId, branchId: target.id, name: source.name, unit: source.unit, quantity: 0, parLevel: 0 },
          { tx }
        );
      } else if (destination.isArchived) {
        destination = await this.inventoryRepository.updateIngredient(destination.id, { isArchived: false }, { tx });
      }

      // Lots leave the oldest first, and arrive with their own history.
      const lots = await this.inventoryRepository.findOpenLotDetails(id, tx);
      const allocations = allocateFifo(lots, dto.quantity);
      await this.inventoryRepository.applyLotUse(allocations, undefined, tx);
      let carried = 0;
      for (const { lotId, quantity } of allocations) {
        const lot = lots.find(l => l.id === lotId);
        if (!lot) continue;
        carried += quantity;
        await this.inventoryRepository.createLot(
          {
            ingredientId: destination.id,
            supplier: lot.supplier ?? undefined,
            cost: lot.cost ? Math.round((lot.cost * quantity) / lot.quantity) : undefined,
            quantity,
            receivedAt: lot.receivedAt,
            createdBy: authEntity.sub,
          },
          tx
        );
      }
      // Stock beyond what any lot accounts for still arrives, just with no history.
      if (carried < dto.quantity) {
        await this.inventoryRepository.createLot(
          { ingredientId: destination.id, quantity: dto.quantity - carried, createdBy: authEntity.sub },
          tx
        );
      }

      const sent = await this.inventoryRepository.applyMovement(
        id,
        -dto.quantity,
        { reason: StockMovementReason.TRANSFER_OUT, note: `To ${target.name}`, createdBy: authEntity.sub },
        tx
      );
      await this.inventoryRepository.applyMovement(
        destination.id,
        dto.quantity,
        { reason: StockMovementReason.TRANSFER_IN, note: "From another branch", createdBy: authEntity.sub },
        tx
      );

      await this.inventoryService.syncAvailability(authEntity.branchId, [id], tx);
      await this.inventoryService.syncAvailability(target.id, [destination.id], tx);

      const detail = `${dto.quantity} ${source.unit} of ${source.name}`;
      await this.auditLogService.record(
        { action: AuditAction.stock_transferred, subject: "Stock transfer", detail: `${detail} sent to ${target.name}` },
        authEntity,
        tx
      );
      // The receiving branch's log gets its own line, so the move reads right from either side.
      await this.auditLogService.record(
        { action: AuditAction.stock_transferred, subject: "Stock transfer", detail: `${detail} received from another branch` },
        { ...authEntity, branchId: target.id },
        tx
      );
      return sent;
    });
  }
}
